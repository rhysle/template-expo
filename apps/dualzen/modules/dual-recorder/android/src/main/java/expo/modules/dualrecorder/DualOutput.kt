package expo.modules.dualrecorder

import android.view.Surface
import androidx.camera.core.Preview
import androidx.camera.core.DynamicRange
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import com.margelo.nitro.camera.*
import com.margelo.nitro.camera.extensions.converters.toDynamicRange
import com.margelo.nitro.camera.public.NativeCameraOutput

class DualOutput(private val channel: Int, private val edge: Int, private val hdr: Boolean) : HybridCameraOutputSpec(), NativeCameraOutput {
  private var preview: Preview? = null
  override val mediaType = MediaType.VIDEO
  override var mirrorMode = MirrorMode.OFF
  override var outputOrientation = CameraOrientation.UP
    set(value) { field = value; preview?.targetRotation = rotation(value) }
  override val currentResolution: Size?
    get() = preview?.resolutionInfo?.resolution?.let { Size(it.width.toDouble(), it.height.toDouble()) }
  override fun createUseCase(mirrorMode: MirrorMode, config: NativeCameraOutput.Config): NativeCameraOutput.PreparedUseCase {
    val dynamicRange = config.videoDynamicRange?.toDynamicRange() ?: DynamicRange.SDR
    require(!hdr || dynamicRange == DynamicRange.HLG_10_BIT) { "The selected camera session did not negotiate HLG10" }
    val selector = ResolutionSelector.Builder()
      .setResolutionStrategy(ResolutionStrategy(android.util.Size(edge, edge * 3 / 4), ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER))
      .setResolutionFilter { sizes, _ -> sizes.filter { maxOf(it.width, it.height) <= edge }.ifEmpty { sizes } }
      .build()
    val stream = Preview.Builder().setResolutionSelector(selector).setTargetRotation(rotation(outputOrientation))
      .setMirrorMode(androidx.camera.core.MirrorMode.MIRROR_MODE_OFF).apply {
        setDynamicRange(dynamicRange)
        config.fpsRange?.let { setTargetFrameRate(it) }
        setPreviewStabilizationEnabled(config.previewStabilizationMode != null && config.previewStabilizationMode != TargetStabilizationMode.OFF)
      }.build()
    return NativeCameraOutput.PreparedUseCase(stream) {
      preview = stream
      stream.setSurfaceProvider(DualEngine.executor) { request -> DualEngine.attach(channel, request, hdr) }
    }
  }
  private fun rotation(value: CameraOrientation) = when (value) {
    CameraOrientation.UP -> Surface.ROTATION_0
    CameraOrientation.RIGHT -> Surface.ROTATION_90
    CameraOrientation.DOWN -> Surface.ROTATION_180
    CameraOrientation.LEFT -> Surface.ROTATION_270
  }
}
