import ExpoModulesCore

final class DualPreview: ExpoView {
  var channel = 0 { didSet { update() } }
  var portrait = true { didSet { update() } }
  var position = 0.5 { didSet { update() } }
  var mirrored = false { didSet { update() } }
  private let preview = DZRecorder.makePreview()
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    addSubview(preview)
  }
  override func layoutSubviews() { super.layoutSubviews(); preview.frame = bounds }
  private func update() { DZRecorder.updatePreview(preview, channel: channel, portrait: portrait, position: position, mirrored: mirrored) }
}
