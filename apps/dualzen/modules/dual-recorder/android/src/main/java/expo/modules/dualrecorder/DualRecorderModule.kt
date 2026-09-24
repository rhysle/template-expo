package expo.modules.dualrecorder

import android.content.ContentValues
import android.content.Intent
import android.media.*
import android.os.Build
import android.os.StatFs
import android.provider.MediaStore
import android.graphics.Bitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import java.io.File
import java.util.UUID

class DualRecorderModule : Module() {
  override fun definition()=ModuleDefinition {
    Name("DualRecorder")
    Events("onStopped")
    OnCreate {
      System.loadLibrary("DualRecorder")
      val ctx=appContext.reactContext?:error("React context unavailable")
      DualEngine.initializeThermal(ctx)
      DualEngine.onStopped={sendEvent("onStopped",mapOf("result" to it))}
    }
    OnDestroy { DualEngine.onStopped=null;DualEngine.destroy() }
    OnActivityEntersBackground { DualEngine.handler.post { DualEngine.finish("interruption") } }
    AsyncFunction("start") { request: String -> DualEngine.start(request) }
    AsyncFunction("stop") { DualEngine.stop() }
    AsyncFunction("stats") { DualEngine.stats() }
    AsyncFunction("canEncode") { edge: Int,fps: Int,hdr: Boolean ->
      canEncode(edge, fps, hdr)
    }
    AsyncFunction("capabilities") {
      val hdr = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        DualEngine.supportsHdrGraphics() && canEncode(720, 30, true)
      "{\"hdr\":$hdr,\"mov\":false}"
    }
    Function("photoLibraryPermissionStatus") { "authorized" }
    AsyncFunction("requestPhotoLibraryPermission") { "authorized" }
    AsyncFunction("openPhotoLibrary") {
      val activity = appContext.currentActivity ?: error("Active activity unavailable")
      activity.startActivity(
        Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_GALLERY)
      )
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("writeManifest") { uri: String,content: String ->
      val file=android.util.AtomicFile(DualEngine.localFile(uri))
      val stream=file.startWrite()
      try { stream.write(content.toByteArray(Charsets.UTF_8));file.finishWrite(stream) }
      catch(t: Throwable){file.failWrite(stream);throw t}
    }
    AsyncFunction("exportMedia") { uri: String,mediaType: String ->
      val ctx=appContext.reactContext?:error("React context unavailable")
      require(Build.VERSION.SDK_INT>=29){"Gallery export requires Android 10 or later"}
      require(mediaType=="video"||mediaType=="photo"){"Unsupported media type"}
      val source=DualEngine.localFile(uri)
      check(StatFs(source.parentFile!!.path).availableBytes>source.length()+32L*1024*1024){"Not enough space to export; original is safe"}
      val photo=mediaType=="photo"
      val values=ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME,"DualZen_"+UUID.randomUUID().toString()+"_"+source.name)
        put(MediaStore.MediaColumns.MIME_TYPE,if(photo)"image/jpeg" else "video/mp4")
        put(MediaStore.MediaColumns.RELATIVE_PATH,if(photo)"Pictures/DualZen" else "Movies/DualZen")
        put(MediaStore.MediaColumns.IS_PENDING,1)
      }
      val collection=if(photo)MediaStore.Images.Media.EXTERNAL_CONTENT_URI else MediaStore.Video.Media.EXTERNAL_CONTENT_URI
      val target=ctx.contentResolver.insert(collection,values)?:error("Cannot create Gallery asset")
      try {
        ctx.contentResolver.openOutputStream(target)?.use { output -> source.inputStream().use { it.copyTo(output) } }?:error("Cannot write Gallery asset")
        ctx.contentResolver.update(target,ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING,0) },null,null)
        Unit
      }catch(t: Throwable){ctx.contentResolver.delete(target,null,null);throw t}
    }
    AsyncFunction("thumbnail") { uri: String,destination: String ->
      val retriever=MediaMetadataRetriever()
      try { retriever.setDataSource(DualEngine.localFile(uri).path)
        retriever.getFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let { bitmap ->
          val scale=minOf(1.0,480.0/maxOf(bitmap.width,bitmap.height))
          val small=Bitmap.createScaledBitmap(bitmap,(bitmap.width*scale).toInt(),(bitmap.height*scale).toInt(),true)
          DualEngine.localFile(destination).outputStream().use { small.compress(Bitmap.CompressFormat.JPEG,80,it) }
          if(small!==bitmap)small.recycle();bitmap.recycle()
        }
      }finally{retriever.release()}
    }
    View(DualPreview::class) {
      Prop("channel") { view: DualPreview,value: Int -> view.channel=value }
      Prop("portrait") { view: DualPreview,value: Boolean -> view.portrait=value }
      Prop("cropPosition") { view: DualPreview,value: Double -> view.position=value }
      Prop("mirrored") { view: DualPreview,value: Boolean -> view.mirrored=value }
    }
  }

  private fun canEncode(edge: Int, fps: Int, hdr: Boolean): Boolean {
    if (edge <= 0 || fps <= 0) return false
    if (hdr && (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || !DualEngine.supportsHdrGraphics())) return false
    val unit = edge / 32
    val mime = if (hdr) MediaFormat.MIMETYPE_VIDEO_HEVC else MediaFormat.MIMETYPE_VIDEO_AVC
    val format = MediaFormat.createVideoFormat(mime, unit * 18, unit * 32).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, maxOf(4_000_000, (unit * 18.0 * unit * 32 * fps * if (hdr) 0.14 else 0.18).toInt()))
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
      if (hdr) {
        setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.HEVCProfileMain10)
        setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT2020)
        setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_HLG)
        setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
      } else {
        setInteger(MediaFormat.KEY_COLOR_STANDARD, MediaFormat.COLOR_STANDARD_BT709)
        setInteger(MediaFormat.KEY_COLOR_TRANSFER, MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
        setInteger(MediaFormat.KEY_COLOR_RANGE, MediaFormat.COLOR_RANGE_LIMITED)
      }
      if (Build.VERSION.SDK_INT >= 29) setInteger(MediaFormat.KEY_MAX_B_FRAMES, 0)
    }
    return MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
      info.isEncoder && (Build.VERSION.SDK_INT < 29 || info.isHardwareAccelerated) &&
        info.supportedTypes.any { it.equals(mime, true) } && runCatching {
          val caps = info.getCapabilitiesForType(mime)
          val video = caps.videoCapabilities ?: return@runCatching false
          caps.maxSupportedInstances >= 2 &&
            caps.colorFormats.contains(MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface) &&
            (!hdr || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
              caps.isFeatureSupported(MediaCodecInfo.CodecCapabilities.FEATURE_HdrEditing))) &&
            caps.isFormatSupported(format) &&
            video.areSizeAndRateSupported(unit * 18, unit * 32, fps.toDouble()) &&
            video.areSizeAndRateSupported(unit * 32, unit * 18, fps.toDouble())
        }.getOrDefault(false)
    }
  }
}
