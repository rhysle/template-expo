package expo.modules.dualrecorder

import android.content.ContentValues
import android.media.*
import android.os.Build
import android.os.StatFs
import android.provider.MediaStore
import android.graphics.Bitmap
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer
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
      if(hdr||edge<=0||fps<=0)false else {
        val unit=edge/32
        MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { info ->
          info.isEncoder && (Build.VERSION.SDK_INT<29||info.isHardwareAccelerated) && info.supportedTypes.any { it.equals("video/avc",true) } && runCatching {
            val caps=info.getCapabilitiesForType("video/avc")
            caps.maxSupportedInstances>=2 && caps.colorFormats.contains(MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface) &&
              caps.videoCapabilities.areSizeAndRateSupported(unit*18,unit*32,fps.toDouble()) && caps.videoCapabilities.areSizeAndRateSupported(unit*32,unit*18,fps.toDouble())
          }.getOrDefault(false)
        }
      }
    }
    AsyncFunction("capabilities") { "{\"hdr\":false,\"mov\":false}" }
    AsyncFunction("writeManifest") { uri: String,content: String ->
      val file=android.util.AtomicFile(DualEngine.localFile(uri))
      val stream=file.startWrite()
      try { stream.write(content.toByteArray(Charsets.UTF_8));file.finishWrite(stream) }
      catch(t: Throwable){file.failWrite(stream);throw t}
    }
    AsyncFunction("exportMedia") { uri: String,mediaType: String,start: Double,end: Double ->
      val ctx=appContext.reactContext?:error("React context unavailable")
      require(Build.VERSION.SDK_INT>=29){"Gallery export requires Android 10 or later"}
      require(mediaType=="video"||mediaType=="photo"){"Unsupported media type"}
      val source=DualEngine.localFile(uri)
      val temporary=File(ctx.cacheDir,UUID.randomUUID().toString()+".mp4")
      try {
        val export=if(mediaType=="video"&&start>=0){remux(source,temporary,start,end);temporary} else source
        check(StatFs(source.parentFile!!.path).availableBytes>export.length()+32L*1024*1024){"Not enough space to export; original is safe"}
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
          ctx.contentResolver.openOutputStream(target)?.use { output -> export.inputStream().use { it.copyTo(output) } }?:error("Cannot write Gallery asset")
          ctx.contentResolver.update(target,ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING,0) },null,null)
          target.toString()
        }catch(t: Throwable){ctx.contentResolver.delete(target,null,null);throw t}
      }finally{temporary.delete()}
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
  private fun remux(source: File,destination: File,start: Double,end: Double) {
    require(start.isFinite()&&end.isFinite()&&end>start){"Invalid trim range"}
    check(StatFs(source.parentFile!!.path).availableBytes>source.length()*2+32L*1024*1024){"Not enough space for trimmed export"}
    val extractor=MediaExtractor();var muxer: MediaMuxer?=null
    try {
      extractor.setDataSource(source.path)
      val writer=MediaMuxer(destination.path,MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);muxer=writer
      val tracks=mutableMapOf<Int,Int>();var video=-1;var capacity=1024*1024
      for(index in 0 until extractor.trackCount){val format=extractor.getTrackFormat(index);val mime=format.getString(MediaFormat.KEY_MIME)?:continue
        if(mime.startsWith("video/")||mime.startsWith("audio/")){tracks[index]=writer.addTrack(format);extractor.selectTrack(index)
          if(mime.startsWith("video/"))video=index
          if(format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE))capacity=maxOf(capacity,format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)) }
      }
      check(video>=0){"Video track unavailable"}
      writer.start();val startUs=(start*1e6).toLong();val endUs=(end*1e6).toLong()
      extractor.seekTo(startUs,MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      val buffer=ByteBuffer.allocateDirect(capacity);val info=MediaCodec.BufferInfo();var firstVideo=true
      while(extractor.sampleTrackIndex>=0){val track=extractor.sampleTrackIndex;val pts=extractor.sampleTime
        if(pts>=endUs)break
        if(pts>=startUs){buffer.clear();val bytes=extractor.readSampleData(buffer,0);if(bytes<0)break
          if(track==video&&firstVideo){check(extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC!=0){"Shared cut point is not a video keyframe"};firstVideo=false}
          info.set(0,bytes,pts-startUs,extractor.sampleFlags);writer.writeSampleData(tracks.getValue(track),buffer,info)
        }
        extractor.advance()
      }
      check(!firstVideo){"Trim range contains no video"};writer.stop()
    }finally{extractor.release();muxer?.release()}
  }
}
