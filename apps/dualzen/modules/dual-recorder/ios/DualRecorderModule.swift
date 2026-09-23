import ExpoModulesCore
import AVFoundation
import Photos
import UIKit
import VideoToolbox

public class DualRecorderModule: Module {
  private let encoderValidationLock = NSLock()
  private var observers: [NSObjectProtocol] = []
  public func definition() -> ModuleDefinition {
    Name("DualRecorder")
    Events("onStopped")
    OnCreate { [weak self] in
      DZRecorder.setStoppedHandler { [weak self] result in self?.sendEvent("onStopped", ["result": result]) }
      for name in [UIApplication.didEnterBackgroundNotification, AVAudioSession.interruptionNotification, AVCaptureSession.runtimeErrorNotification, AVCaptureSession.wasInterruptedNotification] {
        self?.observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: nil) { _ in
          DZRecorder.finish("interruption")
        })
      }
    }
    OnDestroy { [weak self] in
      self?.observers.forEach { NotificationCenter.default.removeObserver($0) }
      DZRecorder.setStoppedHandler(nil)
      DZRecorder.finish("interruption")
    }
    AsyncFunction("start") { (request: String) in
      if let failure = DZRecorder.start(request) { throw CaptureError(message: failure) }
    }
    AsyncFunction("capturePhoto") { (request: String) throws -> String in
      try DZRecorder.capturePhoto(request)
    }
    AsyncFunction("stop") { () async -> String in
      await withCheckedContinuation { continuation in DZRecorder.stop { continuation.resume(returning: $0) } }
    }
    AsyncFunction("stats") { () -> String in DZRecorder.stats() }
    AsyncFunction("canEncode") { (edge: Int, fps: Int, hdr: Bool) -> Bool in
      self.encoderValidationLock.lock()
      defer { self.encoderValidationLock.unlock() }
      let unit = edge / 32
      guard unit > 0, fps > 0 else { return false }
      var sessions: [VTCompressionSession] = []
      defer { sessions.forEach { VTCompressionSessionInvalidate($0) } }
      for portrait in [true, false] {
        var session: VTCompressionSession?
        var specification: CFDictionary?
        if #available(iOS 17.4, *) { specification = [kVTVideoEncoderSpecification_RequireHardwareAcceleratedVideoEncoder: true] as CFDictionary }
        let status = VTCompressionSessionCreate(allocator: nil, width: Int32(unit * (portrait ? 18 : 32)), height: Int32(unit * (portrait ? 32 : 18)), codecType: hdr ? kCMVideoCodecType_HEVC : kCMVideoCodecType_H264, encoderSpecification: specification, imageBufferAttributes: nil, compressedDataAllocator: nil, outputCallback: nil, refcon: nil, compressionSessionOut: &session)
        guard status == noErr, let session else { return false }
        sessions.append(session)
        if hdr && VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_HEVC_Main10_AutoLevel) != noErr { return false }
        guard VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: NSNumber(value: fps)) == noErr,
          VTCompressionSessionPrepareToEncodeFrames(session) == noErr else { return false }
      }
      return true
    }
    AsyncFunction("capabilities") { () -> String in "{\"hdr\":true,\"mov\":true}" }
    Function("photoLibraryPermissionStatus") { () -> String in
      Self.photoLibraryPermissionStatus(PHPhotoLibrary.authorizationStatus(for: .addOnly))
    }
    AsyncFunction("requestPhotoLibraryPermission") { () async -> String in
      let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
      return Self.photoLibraryPermissionStatus(status)
    }
    AsyncFunction("writeManifest") { (uri: String, content: String) throws -> Void in
      try Data(content.utf8).write(to: Self.localURL(uri), options: .atomic)
    }
    AsyncFunction("exportMedia") { (uri: String, mediaType: String) async throws -> Void in
      guard mediaType == "video" || mediaType == "photo" else { throw CaptureError(message: "Unsupported media type") }
      let source = try Self.localURL(uri)
      let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
      guard status == .authorized || status == .limited else { throw CaptureError(message: "Photo library permission denied") }
      let url = source
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        PHPhotoLibrary.shared().performChanges({
          _ = mediaType == "video"
            ? PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
            : PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: url)
        }, completionHandler: { success, error in
          if success { continuation.resume(returning: ()) }
          else { continuation.resume(throwing: error ?? CaptureError(message: "Photo library save failed")) }
        })
      }
    }
    AsyncFunction("thumbnail") { (uri: String, destination: String) throws -> Void in
      let asset = AVURLAsset(url: try Self.localURL(uri))
      let generator = AVAssetImageGenerator(asset: asset)
      generator.appliesPreferredTrackTransform = true; generator.maximumSize = CGSize(width: 480, height: 480)
      let image = try generator.copyCGImage(at: .zero, actualTime: nil)
      guard let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.8) else { return }
      try data.write(to: Self.localURL(destination), options: .atomic)
    }
    View(DualPreview.self) {
      Prop("channel") { (view: DualPreview, value: Int) in view.channel = value }
      Prop("portrait") { (view: DualPreview, value: Bool) in view.portrait = value }
      Prop("cropPosition") { (view: DualPreview, value: Double) in view.position = value }
      Prop("mirrored") { (view: DualPreview, value: Bool) in view.mirrored = value }
    }
  }
  private static func localURL(_ uri: String) throws -> URL {
    guard let url = URL(string: uri), url.isFileURL else { throw CaptureError(message: "Invalid local media") }
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].standardizedFileURL.path
    guard url.standardizedFileURL.path.hasPrefix(root + "/DualZen/") else { throw CaptureError(message: "File is outside project storage") }
    return url
  }
  private static func photoLibraryPermissionStatus(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "not-determined"
    case .authorized, .limited: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    @unknown default: return "restricted"
    }
  }
}

private struct CaptureError: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}
