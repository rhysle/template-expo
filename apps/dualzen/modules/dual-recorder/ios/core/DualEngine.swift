import AVFoundation
import CoreImage
import Metal
import Foundation
import UIKit

struct CaptureError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// All recording and audio callbacks share this serial queue. No per-frame JS traffic.
final class DualEngine: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate {
  static let shared = DualEngine()
  let queue = DispatchQueue(label: "com.rhysle.dualzen.recording", qos: .userInitiated)
  let context = CIContext(mtlDevice: MTLCreateSystemDefaultDevice()!, options: [.cacheIntermediates: false])
  var onStopped: ((String) -> Void)?
  private let previews = NSHashTable<DualGPUPreview>.weakObjects()
  private let previewLock = NSLock()
  private var rotations: [Int: Double] = [:]
  private var pixelFormats: [Int: OSType] = [:]
  private var sources: [Int: (CIImage, CMTime)] = [:]
  private var pairedPTS: [Int: CMTime] = [:]
  private var sinks: [VideoSink] = []
  private var audioSession: AVCaptureSession?
  private var timer: DispatchSourceTimer?
  private var config: [String: Any] = [:]
  private var origin: CMTime?
  // Retain at most one microphone buffer while waiting for the first video frame.
  private var firstAudio: CMSampleBuffer?
  private var lastPTS = CMTime.zero
  private var stopping = false
  private var pending: [(String) -> Void] = []
  private var lastResult = "{}"
  private var failure: String?
  private var recordedFrames = 0
  private var droppedFrames = 0
  // UIKit access is confined to the main queue. Request time before backgrounding.
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  private func beginFinalizationAllowance() {
    DispatchQueue.main.async {
      guard self.backgroundTask == .invalid else { return }
      self.backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "DualZen finalization") {
        if self.backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(self.backgroundTask); self.backgroundTask = .invalid }
      }
    }
  }
  private func endFinalizationAllowance() {
    DispatchQueue.main.async {
      if self.backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(self.backgroundTask); self.backgroundTask = .invalid }
    }
  }

  func register(_ preview: DualGPUPreview) {
    previewLock.lock(); previews.add(preview); previewLock.unlock()
  }
  func frame(_ sample: CMSampleBuffer, channel: Int, rotation: Double) {
    guard let buffer = CMSampleBufferGetImageBuffer(sample) else { return }
    rotations[channel] = rotation
    pixelFormats[channel] = CVPixelBufferGetPixelFormatType(buffer)
    let image = CIImage(cvPixelBuffer: buffer)
    let pts = CMSampleBufferGetPresentationTimeStamp(sample)
    sources[channel] = (image, pts)
    previewLock.lock(); let views = previews.allObjects; previewLock.unlock()
    for view in views where view.channel == channel { view.offer(image) }
    guard !sinks.isEmpty, !stopping else { return }
    if config["mode"] as? String == "dual" {
      guard let a = sources[1], let b = sources[2] else { return }
      guard a.1 > (pairedPTS[1] ?? .negativeInfinity), b.1 > (pairedPTS[2] ?? .negativeInfinity) else { return }
      let tolerance = 0.5 / Double(config["fps"] as? Int ?? 30)
      if abs(CMTimeGetSeconds(a.1 - b.1)) > tolerance { return }
      pairedPTS[1] = a.1; pairedPTS[2] = b.1
      append([(a.0, max(a.1, b.1)), (b.0, max(a.1, b.1))])
    } else {
      append([(image, pts), (image, pts)])
    }
  }

  static func crop(_ size: CGSize, portrait: Bool, position: Double) -> CGRect {
    let ratio: CGFloat = portrait ? 9 / 16 : 16 / 9
    let width = min(size.width, size.height * ratio)
    let height = min(size.height, size.width / ratio)
    let p = CGFloat(max(0, min(1, position)))
    return CGRect(x: (size.width - width) * p, y: (size.height - height) * (1 - p), width: width, height: height)
  }
  static func outputSize(_ source: CGSize, portrait: Bool, edge: Double) -> CGSize {
    let rect = crop(source, portrait: portrait, position: 0.5)
    let scale = min(1, CGFloat(edge) / max(rect.width, rect.height))
    let unit = floor(min(rect.width * scale / (portrait ? 18 : 32), rect.height * scale / (portrait ? 32 : 18)))
    return CGSize(width: unit * (portrait ? 18 : 32), height: unit * (portrait ? 32 : 18))
  }
  static func freeBytes(_ url: URL) -> Int64 {
    (try? url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage) ?? 0
  }
  func stats() -> String {
    queue.sync {
      var value: [String: Any] = ["thermal": ProcessInfo.processInfo.thermalState.rawValue,
        "recording": !sinks.isEmpty, "frames": recordedFrames, "dropped": droppedFrames,
        "freeBytes": Self.freeBytes(FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])]
      for (channel, source) in sources {
        value["source\(channel)"] = ["width": source.0.extent.width, "height": source.0.extent.height, "rotation": rotations[channel] ?? 0]
      }
      return Self.json(value)
    }
  }
  func start(_ text: String) throws {
    guard let data = text.data(using: .utf8), let request = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw CaptureError(message: "Invalid recording configuration")
    }
    try queue.sync {
      guard sinks.isEmpty, !stopping else { throw CaptureError(message: "Recorder is busy") }
      guard ProcessInfo.processInfo.thermalState != .critical else { throw CaptureError(message: "Phone is too hot") }
      guard let path = request["directory"] as? String, let url = URL(string: path), url.isFileURL else { throw CaptureError(message: "Invalid take directory") }
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].standardizedFileURL.path
      guard url.standardizedFileURL.path.hasPrefix(root + "/DualZen/") else { throw CaptureError(message: "Directory is outside recording storage") }
      try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
      let reserve = request["reserveBytes"] as? Int64 ?? 268435456
      guard Self.freeBytes(url) > reserve else { throw CaptureError(message: "Not enough storage") }
      let channels = request["mode"] as? String == "dual" ? [1, 2] : [0, 0]
      if request["hdr"] as? Bool == true {
        guard channels.allSatisfy({ pixelFormats[$0] == kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange }) else { throw CaptureError(message: "Camera negotiated an incompatible HDR pixel format") }
      }
      let edge = request["longEdge"] as? Double ?? 1920
      let mirrorFrontCamera = (request["mode"] as? String) == "single" &&
        (request["front"] as? Bool) == true &&
        (request["mirrorFrontCamera"] as? Bool) == true
      let fps = request["fps"] as? Int ?? 30
      var prepared: [VideoSink] = []
      beginFinalizationAllowance()
      do {
        for index in 0..<2 {
          guard let source = sources[channels[index]] else { throw CaptureError(message: "Waiting for camera frames") }
          let size = Self.outputSize(source.0.extent.size, portrait: index == 0, edge: edge)
          let name = index == 0 ? "portrait" : "landscape"
          prepared.append(try VideoSink(url: url.appendingPathComponent(name + "." + (request["container"] as? String ?? "mp4")), size: size,
            fps: fps, hdr: request["hdr"] as? Bool ?? false, portrait: index == 0,
            position: request[index == 0 ? "portraitPosition" : "landscapePosition"] as? Double ?? 0.5,
            mirror: mirrorFrontCamera))
        }
        let session = AVCaptureSession()
        guard let mic = AVCaptureDevice.default(for: .audio) else { throw CaptureError(message: "Microphone unavailable") }
        let input = try AVCaptureDeviceInput(device: mic)
        let output = AVCaptureAudioDataOutput()
        guard session.canAddInput(input), session.canAddOutput(output) else { throw CaptureError(message: "Cannot prepare microphone") }
        session.addInput(input); session.addOutput(output)
        output.setSampleBufferDelegate(self, queue: queue)
        session.startRunning()
        audioSession = session
      } catch {
        for sink in prepared { sink.writer.cancelWriting(); try? FileManager.default.removeItem(at: sink.url) }
        endFinalizationAllowance()
        throw error
      }
      config = request; sinks = prepared; origin = nil; firstAudio = nil; lastPTS = .zero; failure = nil; recordedFrames = 0; droppedFrames = 0; pairedPTS.removeAll()
      let poll = DispatchSource.makeTimerSource(queue: queue)
      poll.schedule(deadline: .now() + 1, repeating: 1)
      poll.setEventHandler { [weak self] in
        guard let self, !self.sinks.isEmpty, !self.stopping else { return }
        if ProcessInfo.processInfo.thermalState == .critical { self.finish(reason: "thermal", completion: nil) }
        else if Self.freeBytes(url) <= reserve { self.finish(reason: "storage", completion: nil) }
      }
      timer = poll; poll.resume()
    }
  }

  func capturePhoto(_ text: String) throws -> String {
    guard let data = text.data(using: .utf8),
      let request = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { throw CaptureError(message: "Invalid photo configuration") }
    return try queue.sync {
      guard sinks.isEmpty, !stopping else { throw CaptureError(message: "Recorder is busy") }
      guard let path = request["directory"] as? String,
        let directory = URL(string: path), directory.isFileURL
      else { throw CaptureError(message: "Invalid take directory") }
      let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .standardizedFileURL.path
      guard directory.standardizedFileURL.path.hasPrefix(root + "/DualZen/")
      else { throw CaptureError(message: "Directory is outside recording storage") }
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

      let channels = request["mode"] as? String == "dual" ? [1, 2] : [0, 0]
      let edge = request["longEdge"] as? Double ?? 1920
      let mirrorFrontCamera = (request["mode"] as? String) == "single" &&
        (request["front"] as? Bool) == true &&
        (request["mirrorFrontCamera"] as? Bool) == true
      var outputs: [[String: Any]] = []
      for index in 0..<2 {
        guard let source = sources[channels[index]]?.0 else {
          throw CaptureError(message: "Waiting for camera frames")
        }
        let portrait = index == 0
        let position = request[portrait ? "portraitPosition" : "landscapePosition"] as? Double ?? 0.5
        let rect = Self.crop(source.extent.size, portrait: portrait, position: position)
        let size = Self.outputSize(source.extent.size, portrait: portrait, edge: edge)
        let scaled = source.cropped(to: rect)
          .transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
          .transformed(by: CGAffineTransform(scaleX: size.width / rect.width,
            y: size.height / rect.height))
        let rendered = mirrorFrontCamera
          ? scaled.transformed(by: CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: size.width, ty: 0))
          : scaled
        guard let cgImage = context.createCGImage(rendered, from: CGRect(origin: .zero, size: size)),
          let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.9)
        else { throw CaptureError(message: "Photo rendering failed") }
        let name = portrait ? "portrait.jpg" : "landscape.jpg"
        let url = directory.appendingPathComponent(name)
        try jpeg.write(to: url, options: .atomic)
        if portrait {
          let thumbnailScale = min(1, 480 / max(size.width, size.height))
          let thumbnailSize = CGSize(width: max(1, round(size.width * thumbnailScale)),
            height: max(1, round(size.height * thumbnailScale)))
          let format = UIGraphicsImageRendererFormat()
          format.scale = 1
          let image = UIImage(cgImage: cgImage)
          let thumbnail = UIGraphicsImageRenderer(size: thumbnailSize, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: thumbnailSize))
          }
          if let thumbnailData = thumbnail.jpegData(compressionQuality: 0.8) {
            try thumbnailData.write(to: directory.appendingPathComponent("thumbnail.jpg"), options: .atomic)
          }
        }
        outputs.append(["kind": portrait ? "portrait" : "landscape", "filename": name,
          "width": Int(size.width), "height": Int(size.height), "bytes": jpeg.count, "ready": true])
      }
      return Self.json(["outputs": outputs])
    }
  }

  private func append(_ frames: [(CIImage, CMTime)]) {
    let pts = frames[0].1
    if origin == nil {
      guard let audio = firstAudio, pts >= CMSampleBufferGetPresentationTimeStamp(audio) else { return }
      origin = pts
      for sink in sinks {
        guard sink.writer.startWriting() else { failure = sink.writer.error?.localizedDescription ?? "Encoder could not start"; finish(reason: "encoder", completion: nil); return }
        sink.writer.startSession(atSourceTime: pts)
      }
      firstAudio = nil
      // The writer clips the preceding part of this buffer to the session start.
      // This avoids filming a silent microphone-startup gap without retiming audio.
      guard appendAudio(audio) else { return }
    }
    guard pts > lastPTS else { return }
    guard sinks.allSatisfy({ $0.video.isReadyForMoreMediaData }) else { droppedFrames += 1; return }
    do {
      for (index, sink) in sinks.enumerated() { try sink.append(frames[index].0, pts: pts, context: context) }
      lastPTS = pts; recordedFrames += 1
    } catch { failure = error.localizedDescription; finish(reason: "encoder", completion: nil) }
  }
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard !sinks.isEmpty, !stopping else { return }
    guard let clock = audioSession?.synchronizationClock else { return }
    // Vision Camera's video-only session uses the host clock. Convert the microphone
    // session's clock explicitly, including its relative rate, instead of assuming equality.
    var count = 0
    CMSampleBufferGetSampleTimingInfoArray(sampleBuffer, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
    var timings = Array(repeating: CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: .invalid, decodeTimeStamp: .invalid), count: count)
    guard count > 0, CMSampleBufferGetSampleTimingInfoArray(sampleBuffer, entryCount: count, arrayToFill: &timings, entriesNeededOut: nil) == noErr else { failure = "Cannot read microphone timing"; finish(reason: "audio", completion: nil); return }
    let host = CMClockGetHostTimeClock()
    for index in timings.indices {
      let original = timings[index].presentationTimeStamp
      let converted = CMSyncConvertTime(original, from: clock, to: host)
      if timings[index].duration.isValid { timings[index].duration = CMSyncConvertTime(original + timings[index].duration, from: clock, to: host) - converted }
      timings[index].presentationTimeStamp = converted
      if timings[index].decodeTimeStamp.isValid { timings[index].decodeTimeStamp = CMSyncConvertTime(timings[index].decodeTimeStamp, from: clock, to: host) }
    }
    var retimed: CMSampleBuffer?
    guard CMSampleBufferCreateCopyWithNewTiming(allocator: nil, sampleBuffer: sampleBuffer, sampleTimingEntryCount: count, sampleTimingArray: &timings, sampleBufferOut: &retimed) == noErr, let retimed else { failure = "Cannot align microphone timing"; finish(reason: "audio", completion: nil); return }
    let pts = CMSampleBufferGetPresentationTimeStamp(retimed)
    guard pts.isValid, CMTimeGetSeconds(pts).isFinite else { return }
    // Preserve the earliest microphone sample until a video frame reaches its
    // timestamp. Replacing it on every audio callback creates a moving target
    // that can prevent short recordings from ever starting the asset writer.
    guard let origin else {
      if firstAudio == nil { firstAudio = retimed }
      return
    }
    guard pts >= origin else { return }
    _ = appendAudio(retimed)
  }
  private func appendAudio(_ sample: CMSampleBuffer) -> Bool {
    // Retain the capture clock: never invent an audio timestamp from frame count.
    for sink in sinks {
      guard sink.audio.isReadyForMoreMediaData, sink.audio.append(sample) else {
        failure = "Audio encoder could not keep up"; finish(reason: "audio", completion: nil); return false
      }
      sink.audioSamples += 1
    }
    return true
  }
  func stop(_ completion: @escaping (String) -> Void) { queue.async { self.finish(reason: "manual", completion: completion) } }
  func finish(reason: String, completion: ((String) -> Void)?) {
    if let completion { pending.append(completion) }
    if stopping { return }
    guard !sinks.isEmpty else { let callbacks = pending; pending.removeAll(); callbacks.forEach { $0(lastResult) }; return }
    stopping = true; timer?.cancel(); timer = nil
    audioSession?.stopRunning(); audioSession = nil
    let captured = sinks; let capturedOrigin = origin
    let elapsed = capturedOrigin.map { CMTimeGetSeconds(lastPTS - $0) + 1 / Double(config["fps"] as? Int ?? 30) } ?? 0
    let duration = elapsed.isFinite ? max(0, elapsed) : 0
    let group = DispatchGroup()
    for sink in captured {
      if sink.writer.status == .writing {
        if let capturedOrigin, duration > 0 {
          sink.writer.endSession(atSourceTime: capturedOrigin + CMTime(seconds: duration, preferredTimescale: 60000))
        }
        sink.video.markAsFinished(); sink.audio.markAsFinished(); group.enter(); sink.writer.finishWriting { group.leave() }
      }
      else { sink.writer.cancelWriting() }
    }
    group.notify(queue: queue) {
      let outputs = captured.map { sink -> [String: Any] in
        var ready = sink.writer.status == .completed && duration > 0 && sink.audioSamples > 0
        var metadataError: Error?
        if ready, (self.config["fps"] as? Int ?? 30) >= 120, sink.url.pathExtension.lowercased() == "mp4" {
          do { try MP4PlaybackIntent.writeFullSpeed(to: sink.url) }
          catch { ready = false; metadataError = error }
        }
        var result: [String: Any] = ["kind": sink.portrait ? "portrait" : "landscape", "filename": sink.url.lastPathComponent,
          "width": Int(sink.size.width), "height": Int(sink.size.height), "bitrate": sink.bitrate,
          "bytes": (try? sink.url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0, "ready": ready]
        if !ready {
          let finalizationError: String
          if sink.writer.status != .completed { finalizationError = "Video writer did not complete" }
          else if duration <= 0 { finalizationError = "Video contained no finalized frames" }
          else if sink.audioSamples <= 0 { finalizationError = "Video contained no finalized audio" }
          else { finalizationError = "Video was not finalized" }
          result["error"] = metadataError?.localizedDescription ?? sink.writer.error?.localizedDescription ?? self.failure ?? finalizationError
        }
        return result
      }
      var result: [String: Any] = ["id": self.config["id"] as? String ?? "", "duration": duration,
        "outputs": outputs, "reason": reason, "frames": self.recordedFrames, "dropped": self.droppedFrames,
        "writerStatuses": captured.map { $0.writer.status.rawValue },
        "audioSampleCounts": captured.map { $0.audioSamples }]
      if let failure = self.failure { result["error"] = failure }
      // Save finalized originals natively before emitting the JS event. The JS
      // runtime may already be suspended when filming stops in the background.
      if let directory = self.config["directory"] as? String, let url = URL(string: directory) {
        var media: [String: Any] = ["id": self.config["id"] as? String ?? "", "projectId": self.config["projectId"] as? String ?? "default", "mediaType": "video",
          "createdAt": self.config["createdAt"] as? Double ?? 0, "settings": self.config["settings"] as? [String: Any] ?? [:], "duration": duration,
          "outputs": outputs, "reason": reason]
        if let failure = self.failure { media["error"] = failure }
        do {
          // Foundation raises an Objective-C exception for invalid JSON objects;
          // Swift's do/catch cannot catch that exception in the Nitro engine.
          guard JSONSerialization.isValidJSONObject(media) else {
            #if DEBUG
            for (key, value) in media where !JSONSerialization.isValidJSONObject(["value": value]) {
              print("[DualZen] Invalid media metadata field: \(key), type: \(type(of: value))")
            }
            #endif
            throw CaptureError(message: "Invalid media metadata")
          }
          try JSONSerialization.data(withJSONObject: media).write(to: url.appendingPathComponent("manifest.json"), options: .atomic)
        }
        catch { result["error"] = "Media metadata could not be saved: " + error.localizedDescription }
      }
      self.lastResult = Self.json(result); self.sinks.removeAll(); self.stopping = false; self.origin = nil; self.firstAudio = nil
      let callbacks = self.pending; self.pending.removeAll(); callbacks.forEach { $0(self.lastResult) }
      self.onStopped?(self.lastResult)
      self.endFinalizationAllowance()
    }
  }
  static func json(_ object: [String: Any]) -> String {
    guard JSONSerialization.isValidJSONObject(object) else { return "{}" }
    guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
    return String(data: data, encoding: .utf8) ?? "{}"
  }
}

private final class VideoSink {
  let writer: AVAssetWriter
  let video: AVAssetWriterInput
  let audio: AVAssetWriterInput
  var audioSamples = 0
  let adaptor: AVAssetWriterInputPixelBufferAdaptor
  let url: URL
  let size: CGSize
  let portrait: Bool
  let position: Double
  let mirror: Bool
  let bitrate: Int
  private let colorSpace: CGColorSpace

  init(url: URL, size: CGSize, fps: Int, hdr: Bool, portrait: Bool, position: Double, mirror: Bool) throws {
    guard size.width >= 18, size.height >= 18 else { throw CaptureError(message: "Invalid video dimensions") }
    self.url = url; self.size = size; self.portrait = portrait; self.position = position; self.mirror = mirror
    bitrate = max(4_000_000, Int(size.width * size.height * Double(fps) * (hdr ? 0.14 : 0.18)))
    colorSpace = CGColorSpace(name: hdr ? CGColorSpace.itur_2100_HLG : CGColorSpace.itur_709)!
    writer = try AVAssetWriter(outputURL: url, fileType: url.pathExtension == "mov" ? .mov : .mp4)
    // AVAssetWriter preserves this metadata in MOV; MP4 gets it after finalization.
    if #available(iOS 18.0, *), fps >= 120, url.pathExtension.lowercased() == "mov" {
      let playbackIntent = AVMutableMetadataItem()
      playbackIntent.identifier = .quickTimeMetadataFullFrameRatePlaybackIntent
      playbackIntent.value = NSNumber(value: 1)
      playbackIntent.dataType = kCMMetadataBaseDataType_SInt8 as String
      writer.metadata = [playbackIntent]
    }
    let colors: [String: String] = [AVVideoColorPrimariesKey: hdr ? AVVideoColorPrimaries_ITU_R_2020 : AVVideoColorPrimaries_ITU_R_709_2,
      AVVideoTransferFunctionKey: hdr ? AVVideoTransferFunction_ITU_R_2100_HLG : AVVideoTransferFunction_ITU_R_709_2,
      AVVideoYCbCrMatrixKey: hdr ? AVVideoYCbCrMatrix_ITU_R_2020 : AVVideoYCbCrMatrix_ITU_R_709_2]
    var compression: [String: Any] = [AVVideoAverageBitRateKey: bitrate, AVVideoExpectedSourceFrameRateKey: fps,
      AVVideoMaxKeyFrameIntervalKey: fps * 2, AVVideoAllowFrameReorderingKey: false]
    if hdr { compression[AVVideoProfileLevelKey] = "HEVC_Main10_AutoLevel" }
    else { compression[AVVideoMaxKeyFrameIntervalDurationKey] = 2.0 }
    let settings: [String: Any] = [AVVideoCodecKey: hdr ? AVVideoCodecType.hevc : AVVideoCodecType.h264,
      AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height), AVVideoColorPropertiesKey: colors,
      AVVideoCompressionPropertiesKey: compression]
    guard writer.canApply(outputSettings: settings, forMediaType: .video) else { throw CaptureError(message: "Video encoder cannot support these settings") }
    video = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
    audio = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 128000])
    video.expectsMediaDataInRealTime = true; audio.expectsMediaDataInRealTime = true
    adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes:
      [kCVPixelBufferPixelFormatTypeKey as String: hdr ? kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange : kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
       kCVPixelBufferWidthKey as String: Int(size.width), kCVPixelBufferHeightKey as String: Int(size.height),
       kCVPixelBufferMetalCompatibilityKey as String: true, kCVPixelBufferIOSurfacePropertiesKey as String: [:]])
    guard writer.canAdd(video), writer.canAdd(audio) else { throw CaptureError(message: "Cannot attach video/audio encoders") }
    writer.add(video); writer.add(audio)
  }
  func append(_ image: CIImage, pts: CMTime, context: CIContext) throws {
    guard let pool = adaptor.pixelBufferPool else { throw CaptureError(message: "Video buffer pool unavailable") }
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(nil, pool,
      [kCVPixelBufferPoolAllocationThresholdKey as String: 4] as CFDictionary, &buffer)
    guard status == kCVReturnSuccess, let buffer else { throw CaptureError(message: "Video buffer limit exceeded") }
    let rect = DualEngine.crop(image.extent.size, portrait: portrait, position: position)
    let cropped = image.cropped(to: rect).transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
      .transformed(by: CGAffineTransform(scaleX: size.width / rect.width, y: size.height / rect.height))
    let rendered = mirror
      ? cropped.transformed(by: CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: size.width, ty: 0))
      : cropped
    context.render(rendered, to: buffer, bounds: CGRect(origin: .zero, size: size), colorSpace: colorSpace)
    guard adaptor.append(buffer, withPresentationTime: pts) else { throw writer.error ?? CaptureError(message: "Video encoder failed") }
  }
}


// AVAssetWriter discards QuickTime movie metadata when its output type is MP4.
// Add the same integer-typed mdta item after writing, while the moov box is last.
enum MP4PlaybackIntent {
  private struct Box {
    let offset: UInt64
    let size: UInt64
    let headerSize: UInt64
    let type: [UInt8]
  }

  static func writeFullSpeed(to url: URL) throws {
    let file = try FileHandle(forUpdating: url)
    defer { try? file.close() }
    let fileSize = try file.seekToEnd()
    var offset: UInt64 = 0
    var movie: Box?
    var hasMedia = false

    while offset < fileSize {
      let entry = try readBox(from: file, at: offset, endingAt: fileSize)
      if entry.type == Array("mdat".utf8) { hasMedia = true }
      if entry.type == Array("moov".utf8) { movie = entry }
      offset += entry.size
    }
    guard hasMedia, let movie, movie.offset + movie.size == fileSize,
      movie.headerSize == 8, movie.size <= UInt64(UInt32.max) - UInt64(fullSpeedMetadata.count)
    else { throw CaptureError(message: "MP4 movie metadata cannot be updated") }

    offset = movie.offset + movie.headerSize
    while offset < fileSize {
      let child = try readBox(from: file, at: offset, endingAt: fileSize)
      guard child.type != Array("meta".utf8) else {
        throw CaptureError(message: "MP4 already contains movie metadata")
      }
      offset += child.size
    }

    try file.seek(toOffset: fileSize)
    try file.write(contentsOf: fullSpeedMetadata)
    try file.seek(toOffset: movie.offset)
    try file.write(contentsOf: uint32(UInt32(movie.size) + UInt32(fullSpeedMetadata.count)))
    try file.synchronize()
  }

  private static func readBox(from file: FileHandle, at offset: UInt64, endingAt end: UInt64) throws -> Box {
    guard end - offset >= 8 else { throw CaptureError(message: "Invalid MP4 box") }
    try file.seek(toOffset: offset)
    guard let header = try file.read(upToCount: 8), header.count == 8 else {
      throw CaptureError(message: "Cannot read MP4 box")
    }
    let initialSize = header.prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    let headerSize: UInt64 = initialSize == 1 ? 16 : 8
    let size: UInt64
    if initialSize == 1 {
      guard end - offset >= 16, let extended = try file.read(upToCount: 8), extended.count == 8 else {
        throw CaptureError(message: "Invalid extended MP4 box")
      }
      size = extended.reduce(UInt64(0)) { ($0 << 8) | UInt64($1) }
    } else {
      size = initialSize == 0 ? end - offset : UInt64(initialSize)
    }
    guard size >= headerSize, size <= end - offset else {
      throw CaptureError(message: "Invalid MP4 box size")
    }
    return Box(offset: offset, size: size, headerSize: headerSize, type: Array(header[4..<8]))
  }

  private static func uint32(_ value: UInt32) -> Data {
    Data([UInt8(value >> 24), UInt8((value >> 16) & 0xff),
      UInt8((value >> 8) & 0xff), UInt8(value & 0xff)])
  }

  private static func box(_ type: [UInt8], _ payload: Data) -> Data {
    var value = uint32(UInt32(payload.count + 8))
    value.append(contentsOf: type)
    value.append(payload)
    return value
  }

  private static let fullSpeedMetadata: Data = {
    let key = Data("com.apple.quicktime.full-frame-rate-playback-intent".utf8)
    var handler = Data(repeating: 0, count: 8)
    handler.append(contentsOf: "mdta".utf8)
    handler.append(Data(repeating: 0, count: 12))

    var keyEntry = uint32(UInt32(key.count + 8))
    keyEntry.append(contentsOf: "mdta".utf8)
    keyEntry.append(key)
    var keys = Data(repeating: 0, count: 4)
    keys.append(uint32(1))
    keys.append(keyEntry)

    var value = uint32(21) // com.apple.metadata.datatype.int8
    value.append(uint32(0)) // locale
    value.append(1) // full frame rate
    let item = box([0, 0, 0, 1], box(Array("data".utf8), value))

    var metadata = box(Array("hdlr".utf8), handler)
    metadata.append(box(Array("keys".utf8), keys))
    metadata.append(box(Array("ilst".utf8), item))
    return box(Array("meta".utf8), metadata)
  }()
}
