import AVFoundation
import VisionCamera

final class DualOutputFactory: HybridDualOutputFactorySpec {
  func createOutput(channel: Double, longEdge: Double, hdr: Bool) throws -> any HybridCameraOutputSpec {
    DualOutput(channel: Int(channel), longEdge: longEdge, hdr: hdr)
  }
}

private final class VideoDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  let channel: Int
  init(channel: Int) { self.channel = channel }
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let rotation: Double
    if #available(iOS 17.0, *) { rotation = connection.videoRotationAngle }
    else { switch connection.videoOrientation { case .portrait: rotation = 90; case .portraitUpsideDown: rotation = 270; case .landscapeLeft: rotation = 180; default: rotation = 0 } }
    DualEngine.shared.frame(sampleBuffer, channel: channel, rotation: rotation)
  }
}

final class DualOutput: HybridCameraOutputSpec, NativeCameraOutput {
  let output = AVCaptureVideoDataOutput()
  private let delegate: VideoDelegate
  private let edge: Double
  private let hdr: Bool
  let mediaType: MediaType = .video
  let requiresAudioInput = false
  let requiresDepthFormat = false
  let streamType: StreamType = .video
  var targetResolution: ResolutionRule { .closestTo(Size(width: edge, height: edge * 3 / 4)) }
  var currentResolution: Size? {
    guard let description = output.connection(with: .video)?.inputPorts.first?.formatDescription else { return nil }
    let dimensions = CMVideoFormatDescriptionGetDimensions(description)
    return Size(width: Double(dimensions.width), height: Double(dimensions.height))
  }
  var outputOrientation: CameraOrientation = .up { didSet { applyOrientation() } }

  init(channel: Int, longEdge: Double, hdr: Bool) {
    edge = longEdge
    self.hdr = hdr
    delegate = VideoDelegate(channel: channel)
    super.init()
    // Leave probes device-native: P010 is not available until the HDR format
    // is connected. Requesting it in init can raise an Objective-C exception.
    output.videoSettings = [:]
    output.alwaysDiscardsLateVideoFrames = true
    output.automaticallyConfiguresOutputBufferDimensions = false
    output.deliversPreviewSizedOutputBuffers = false
    output.setSampleBufferDelegate(delegate, queue: DualEngine.shared.queue)
  }
  func configure(config: OutputConfiguration) {
    let format = hdr ? kCVPixelFormatType_420YpCbCr10BiPlanarVideoRange : kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
    // Vision Camera has selected activeFormat and connected the output here.
    if output.availableVideoPixelFormatTypes.contains(format) {
      output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: format]
    }
    // HDR recording still validates the actual sample format before starting.
    applyOrientation()
  }
  private func applyOrientation() {
    guard let connection = output.connection(with: .video) else { return }
    // Physical rotation accounts for front/rear sensor orientation through AVFoundation.
    let orientation: AVCaptureVideoOrientation
    switch outputOrientation {
    case .up: orientation = .portrait
    case .down: orientation = .portraitUpsideDown
    case .left: orientation = .landscapeRight
    case .right: orientation = .landscapeLeft
    }
    if connection.isVideoOrientationSupported { connection.videoOrientation = orientation }
    if connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = false
    }
  }
}
