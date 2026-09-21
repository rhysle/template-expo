import UIKit
import MetalKit
import CoreImage

final class DualGPUPreview: UIView, MTKViewDelegate {
  var channel = 0
  var portrait = true
  var position = 0.5
  var mirrored = false
  private let metalView = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
  private let lock = NSLock()
  private var latest: CIImage?
  private var queued = false
  private let commands: MTLCommandQueue

  override init(frame: CGRect) {
    commands = metalView.device!.makeCommandQueue()!
    super.init(frame: frame)
    metalView.framebufferOnly = false; metalView.isPaused = true; metalView.enableSetNeedsDisplay = false
    metalView.delegate = self; metalView.backgroundColor = .black
    addSubview(metalView); DualEngine.shared.register(self)
  }
  required init?(coder: NSCoder) { return nil }
  override func layoutSubviews() { super.layoutSubviews(); metalView.frame = bounds }
  func offer(_ image: CIImage) {
    lock.lock(); latest = image
    if queued { lock.unlock(); return }
    queued = true; lock.unlock()
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.lock.lock(); self.queued = false; self.lock.unlock()
      self.metalView.draw()
    }
  }
  func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}
  func draw(in view: MTKView) {
    lock.lock(); let image = latest; lock.unlock()
    guard let image, let drawable = view.currentDrawable, let command = commands.makeCommandBuffer(), view.drawableSize.width > 0, view.drawableSize.height > 0 else { return }
    let nativePosition = portrait && mirrored ? 1 - position : position
    let rect = DualEngine.crop(image.extent.size, portrait: portrait, position: nativePosition)
    var cropped = image.cropped(to: rect).transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
    if mirrored { cropped = cropped.transformed(by: CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: rect.width, ty: 0)) }
    let scale = max(view.drawableSize.width / rect.width, view.drawableSize.height / rect.height)
    cropped = cropped.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      .transformed(by: CGAffineTransform(translationX: (view.drawableSize.width - rect.width * scale) / 2, y: (view.drawableSize.height - rect.height * scale) / 2))
    DualEngine.shared.context.render(cropped, to: drawable.texture, commandBuffer: command,
      bounds: CGRect(origin: .zero, size: view.drawableSize), colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
    command.present(drawable); command.commit()
  }
}
