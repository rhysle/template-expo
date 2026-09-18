import Foundation
import UIKit

@objc(DZRecorderCore) public final class DualRecorderCoreBridge: NSObject {
  @objc(start:) public static func start(_ request: String) -> String? {
    do { try DualEngine.shared.start(request); return nil }
    catch { return error.localizedDescription }
  }
  @objc(stop:) public static func stop(_ completion: @escaping (String) -> Void) { DualEngine.shared.stop(completion) }
  @objc(stats) public static func stats() -> String { DualEngine.shared.stats() }
  @objc(finish:) public static func finish(_ reason: String) {
    DualEngine.shared.queue.async { DualEngine.shared.finish(reason: reason, completion: nil) }
  }
  @objc(setStoppedHandler:) public static func setStoppedHandler(_ callback: ((String) -> Void)?) {
    DualEngine.shared.queue.async { DualEngine.shared.onStopped = callback }
  }
  @objc(makePreview) public static func makePreview() -> UIView { DualGPUPreview(frame: .zero) }
  @objc(updatePreview:channel:portrait:position:mirrored:) public static func updatePreview(_ view: UIView, channel: Int, portrait: Bool, position: Double, mirrored: Bool) {
    guard let preview = view as? DualGPUPreview else { return }
    preview.channel = channel; preview.portrait = portrait; preview.position = position; preview.mirrored = mirrored
  }
}
