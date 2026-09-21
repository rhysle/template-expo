package expo.modules.dualrecorder

import android.content.Context
import android.graphics.SurfaceTexture
import android.media.*
import android.opengl.*
import android.os.*
import android.view.Surface
import androidx.camera.core.SurfaceRequest
import com.margelo.nitro.camera.extensions.cameraCharacteristicsOrNull
import android.hardware.camera2.CameraCharacteristics
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executor
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.*

// One GL thread owns camera textures, preview surfaces, both codecs and muxers.
object DualEngine {
  private val thread = HandlerThread("DualZenGPU").apply { start() }
  val handler = Handler(thread.looper)
  val executor = Executor { handler.post(it) }
  var context: Context? = null
  var onStopped: ((String) -> Unit)? = null
  private var display = EGL14.EGL_NO_DISPLAY
  private var eglContext = EGL14.EGL_NO_CONTEXT
  private lateinit var eglConfig: EGLConfig
  private var dummy = EGL14.EGL_NO_SURFACE
  private var program = 0
  private val streams = mutableMapOf<Int, Stream>()
  private val views = mutableMapOf<DualPreview, Window>()
  private val sinks = mutableListOf<VideoSink>()
  private var config = JSONObject()
  @Volatile private var startNs = 0L
  @Volatile private var audioRunning = false
  private var audioThread: Thread? = null
  private var microphone: AudioRecord? = null
  private var aac: MediaCodec? = null
  private var lastPTS = 0L
  private var lastFrameSlot = -1L
  private var frames = 0
  private var dropped = 0
  private var failure: String? = null
  private var lastResult = "{}"
  private var stopping = false
  private var thermal = 0
  private val pendingAudio = AtomicInteger()
  private var power: PowerManager? = null
  private var thermalListener: PowerManager.OnThermalStatusChangedListener? = null

  private data class Stream(val texture: Int, val buffer: SurfaceTexture, val surface: Surface, val width: Int, val height: Int,
    val matrix: FloatArray = FloatArray(16), var rotation: Int = 0, var timestamp: Long = 0, var offset: Long? = null,
    var previousTS: Long = 0, var fps: Double = 0.0)
  private data class Window(val surface: Surface, val egl: EGLSurface)

  private val vertices = ByteBuffer.allocateDirect(16 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
    put(floatArrayOf(-1f,-1f,0f,0f, 1f,-1f,1f,0f, -1f,1f,0f,1f, 1f,1f,1f,1f)); position(0)
  }
  private fun initialize() {
    if (display != EGL14.EGL_NO_DISPLAY) return
    display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    check(EGL14.eglInitialize(display, IntArray(2), 0, IntArray(2), 0)) { "EGL initialization failed" }
    val configs = arrayOfNulls<EGLConfig>(1)
    val attrs = intArrayOf(EGL14.EGL_RED_SIZE,8,EGL14.EGL_GREEN_SIZE,8,EGL14.EGL_BLUE_SIZE,8,
      EGL14.EGL_RENDERABLE_TYPE,EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_SURFACE_TYPE,EGL14.EGL_WINDOW_BIT or EGL14.EGL_PBUFFER_BIT,
      0x3142,1,EGL14.EGL_NONE)
    check(EGL14.eglChooseConfig(display, attrs,0,configs,0,1,IntArray(1),0))
    eglConfig = configs[0]!!
    eglContext = EGL14.eglCreateContext(display,eglConfig,EGL14.EGL_NO_CONTEXT,intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION,2,EGL14.EGL_NONE),0)
    dummy = EGL14.eglCreatePbufferSurface(display,eglConfig,intArrayOf(EGL14.EGL_WIDTH,1,EGL14.EGL_HEIGHT,1,EGL14.EGL_NONE),0)
    current(dummy)
    val vertex = "attribute vec4 aPosition; attribute vec2 aUV; varying vec2 vUV; void main(){gl_Position=aPosition;vUV=aUV;}"
    val fragment = """#extension GL_OES_EGL_image_external : require
precision highp float;
uniform samplerExternalOES uTexture; uniform mat4 uMatrix; uniform vec4 uCrop;
uniform bool uMirror; varying vec2 vUV;
void main(){ vec2 p=vUV; if(uMirror)p.x=1.0-p.x; p=uCrop.xy+p*uCrop.zw;
gl_FragColor=texture2D(uTexture,(uMatrix*vec4(p,0.0,1.0)).xy); }"""
    fun shader(type: Int, source: String): Int {
      val id=GLES20.glCreateShader(type); GLES20.glShaderSource(id,source); GLES20.glCompileShader(id)
      val ok=IntArray(1); GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,ok,0)
      check(ok[0]!=0) { GLES20.glGetShaderInfoLog(id) }; return id
    }
    val v=shader(GLES20.GL_VERTEX_SHADER,vertex); val f=shader(GLES20.GL_FRAGMENT_SHADER,fragment)
    program=GLES20.glCreateProgram(); GLES20.glAttachShader(program,v); GLES20.glAttachShader(program,f); GLES20.glLinkProgram(program)
    val linked=IntArray(1); GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,linked,0); check(linked[0]!=0) { GLES20.glGetProgramInfoLog(program) }
    GLES20.glDeleteShader(v); GLES20.glDeleteShader(f)
  }
  private fun current(surface: EGLSurface) { check(EGL14.eglMakeCurrent(display,surface,surface,eglContext)) { "EGL context lost" } }
  private fun window(surface: Surface): EGLSurface {
    initialize(); return EGL14.eglCreateWindowSurface(display,eglConfig,surface,intArrayOf(EGL14.EGL_NONE),0).also { check(it!=EGL14.EGL_NO_SURFACE) }
  }
  fun attach(channel: Int, request: SurfaceRequest) {
    try {
      initialize(); current(dummy)
      val id=IntArray(1); GLES20.glGenTextures(1,id,0); GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,id[0])
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR)
      GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR)
      val texture=SurfaceTexture(id[0]); texture.setDefaultBufferSize(request.resolution.width,request.resolution.height)
      val surface=Surface(texture)
      val stream=Stream(id[0],texture,surface,request.resolution.width,request.resolution.height)
      val clockSource = request.camera.cameraInfo.cameraCharacteristicsOrNull?.get(CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE)
      if (clockSource == CameraCharacteristics.SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME) stream.offset = System.nanoTime() - SystemClock.elapsedRealtimeNanos()
      streams[channel]=stream
      request.setTransformationInfoListener(executor) { stream.rotation=it.rotationDegrees }
      texture.setOnFrameAvailableListener({
        try { current(dummy); texture.updateTexImage(); texture.getTransformMatrix(stream.matrix)
          val timestamp=texture.timestamp
          if(stream.offset==null)stream.offset=System.nanoTime()-timestamp
          if(stream.previousTS>0 && timestamp>stream.previousTS)stream.fps=if(stream.fps==0.0)1e9/(timestamp-stream.previousTS) else stream.fps*0.9+0.1e9/(timestamp-stream.previousTS)
          stream.previousTS=timestamp; stream.timestamp=timestamp+stream.offset!!
          drawPreviews(channel,stream); encode(channel,stream)
        } catch(error: Throwable) { failure=error.message; finish("encoder") }
      },handler)
      request.provideSurface(surface,executor) {
        if(streams[channel]===stream)streams.remove(channel)
        texture.setOnFrameAvailableListener(null); surface.release(); texture.release()
        current(dummy); GLES20.glDeleteTextures(1,intArrayOf(stream.texture),0)
      }
    } catch(error: Throwable) { request.willNotProvideSurface(); failure=error.message; finish("camera") }
  }
  fun previewAvailable(view: DualPreview, texture: SurfaceTexture) { handler.post {
    try { val surface=Surface(texture); views.remove(view)?.let { EGL14.eglDestroySurface(display,it.egl);it.surface.release() }; views[view]=Window(surface,window(surface)) }
    catch(error: Throwable) { failure=error.message }
  } }
  fun previewGone(view: DualPreview, texture: SurfaceTexture) { handler.post { views.remove(view)?.let { current(dummy); EGL14.eglDestroySurface(display,it.egl);it.surface.release() }; texture.release() } }
  private fun dimensions(stream: Stream): Pair<Int,Int> = if(stream.rotation%180==0)stream.width to stream.height else stream.height to stream.width
  fun size(width: Int,height: Int,portrait: Boolean,edge: Int): Pair<Int,Int> {
    val ratio=if(portrait)9.0/16 else 16.0/9
    val w=min(width.toDouble(),height*ratio);val h=min(height.toDouble(),width/ratio)
    val scale=min(1.0,edge/max(w,h)); val unit=floor(min(w*scale/(if(portrait)18 else 32),h*scale/(if(portrait)32 else 18))).toInt()
    return unit*(if(portrait)18 else 32) to unit*(if(portrait)32 else 18)
  }
  private fun draw(stream: Stream,target: EGLSurface,width: Int,height: Int,portrait: Boolean,position: Double,mirror: Boolean,pts: Long?=null) {
    if(width<=0||height<=0)return
    current(target); GLES20.glViewport(0,0,width,height);GLES20.glUseProgram(program)
    val (sw,sh)=dimensions(stream);val ratio=if(portrait)9.0/16 else 16.0/9
    // The view uses aspect-fit bounds from JS, so this crop matches the encoded output.
    val cw=min(1.0,sh*ratio/sw);val ch=min(1.0,sw/ratio/sh);val p=position.coerceIn(0.0,1.0)
    GLES20.glUniform4f(GLES20.glGetUniformLocation(program,"uCrop"),((1-cw)*p).toFloat(),((1-ch)*(1-p)).toFloat(),cw.toFloat(),ch.toFloat())
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(program,"uMatrix"),1,false,stream.matrix,0)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(program,"uMirror"),if(mirror)1 else 0)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,stream.texture)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(program,"uTexture"),0)
    val ap=GLES20.glGetAttribLocation(program,"aPosition");val au=GLES20.glGetAttribLocation(program,"aUV")
    vertices.position(0);GLES20.glVertexAttribPointer(ap,2,GLES20.GL_FLOAT,false,16,vertices);GLES20.glEnableVertexAttribArray(ap)
    vertices.position(2);GLES20.glVertexAttribPointer(au,2,GLES20.GL_FLOAT,false,16,vertices);GLES20.glEnableVertexAttribArray(au)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4)
    if(pts!=null)EGLExt.eglPresentationTimeANDROID(display,target,pts*1000)
    check(EGL14.eglSwapBuffers(display,target)) { "Surface rendering failed" }
  }
  private fun drawPreviews(channel: Int,stream: Stream) {
    views.toList().filter { it.first.channel==channel }.forEach { (view,target) ->
      val position=if(view.portrait&&view.mirrored)1-view.position else view.position
      draw(stream,target.egl,view.width,view.height,view.portrait,position,view.mirrored)
    }
  }
  private fun encode(channel: Int,stream: Stream) {
    if(sinks.isEmpty()||stopping)return
    val dual=config.optString("mode")=="dual"
    val inputs=if(dual)listOfNotNull(streams[1],streams[2]) else listOf(stream,stream)
    if(inputs.size!=2||inputs.any { it.timestamp==0L })return
    if(dual && abs(inputs[0].timestamp-inputs[1].timestamp)>500_000_000L/config.optInt("fps",30))return
    val captureTime=inputs.maxOf { it.timestamp }
    if(startNs==0L)startNs=captureTime
    val pts=(captureTime-startNs)/1000
    if(frames>0&&pts<=lastPTS)return
    // Multi-camera capture cannot request FPS through Vision Camera. Keep at most
    // one synchronized pair per requested output-frame slot without retiming audio.
    val frameSlot=(pts*config.optInt("fps",30)+500_000L)/1_000_000L
    if(frameSlot<=lastFrameSlot){dropped++;return}
    sinks.forEachIndexed { index,sink ->
      if(pts/2_000_000>sink.lastKeyRequest){sink.codec.setParameters(Bundle().apply { putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME,0) });sink.lastKeyRequest=pts/2_000_000}
      draw(inputs[index],sink.egl,sink.width,sink.height,sink.portrait,sink.position,false,pts)
      sink.drain(false)
    }
    lastPTS=pts;lastFrameSlot=frameSlot;frames++
    if(dual)inputs.forEach { it.timestamp=0 }
  }
  fun start(text: String) {
    val request=JSONObject(text)
    val latch=CountDownLatch(1);var error: Throwable?=null
    handler.post { try {
      check(sinks.isEmpty()&&!stopping){"Recorder is busy"};check(thermal<PowerManager.THERMAL_STATUS_CRITICAL){"Phone is too hot"}
      require(!request.optBoolean("hdr")){"HDR pipeline unavailable"}
      require(request.optString("container")=="mp4"){"MOV is unavailable on Android"}
      val directory=localFile(request.getString("directory"));directory.mkdirs()
      check(StatFs(directory.path).availableBytes>request.optLong("reserveBytes",268435456)){"Not enough storage"}
      val channels=if(request.optString("mode")=="dual")listOf(1,2) else listOf(0,0)
      val prepared=mutableListOf<VideoSink>()
      try {
        channels.forEachIndexed { index,c ->
          val input=streams[c]?:error("Waiting for camera frames");val (w,h)=dimensions(input)
          val (ow,oh)=size(w,h,index==0,request.getInt("longEdge"))
          val sink=VideoSink(File(directory,if(index==0)"portrait.mp4" else "landscape.mp4"),ow,oh,request.getInt("fps"),index==0,
            request.optDouble(if(index==0)"portraitPosition" else "landscapePosition",0.5))
          prepared.add(sink);sink.egl=window(sink.surface)
        }
        prepareAudio()
      } catch(t: Throwable){prepared.forEach { it.release(false) };throw t}
      config=request;sinks.addAll(prepared);startNs=0;lastPTS=0;lastFrameSlot=-1;frames=0;dropped=0;failure=null;pendingAudio.set(0)
      beginAudio(); handler.postDelayed(poll,1000)
    }catch(t: Throwable){error=t}finally{latch.countDown()} }
    latch.await();error?.let { throw it }
  }
  private val poll=object: Runnable { override fun run() {
    if(sinks.isEmpty()||stopping)return
    try { if(thermal>=PowerManager.THERMAL_STATUS_CRITICAL)finish("thermal")
      else if(StatFs(localFile(config.getString("directory")).path).availableBytes<=config.optLong("reserveBytes",268435456))finish("storage")
      else handler.postDelayed(this,1000)
    } catch(t: Throwable){failure=t.message;finish("storage")}
  } }
  fun initializeThermal(ctx: Context) {
    context=ctx
    if(Build.VERSION.SDK_INT>=29){ power=ctx.getSystemService(PowerManager::class.java)
      thermal=power?.currentThermalStatus?:0
      thermalListener=PowerManager.OnThermalStatusChangedListener { status -> handler.post { thermal=status;if(status>=PowerManager.THERMAL_STATUS_CRITICAL)finish("thermal") } }
      power?.addThermalStatusListener(executor,thermalListener!!)
    }
  }
  fun destroy() { handler.post { finish("interruption");if(Build.VERSION.SDK_INT>=29)thermalListener?.let { power?.removeThermalStatusListener(it) };thermalListener=null } }
  fun stats(): String {
    val latch=CountDownLatch(1);var result="{}"
    handler.post { val json=JSONObject().put("thermal",when {thermal>=4->3;thermal>=3->2;thermal>0->1;else->0})
      .put("freeBytes",context?.filesDir?.let { StatFs(it.path).availableBytes }?:0).put("frames",frames).put("dropped",dropped).put("recording",sinks.isNotEmpty())
      streams.forEach { (id,stream) -> val (w,h)=dimensions(stream);json.put("source$id",JSONObject().put("width",w).put("height",h).put("fps",stream.fps).put("rotation",stream.rotation)) }
      result=json.toString();latch.countDown() }
    latch.await();return result
  }
  private fun prepareAudio() {
    val minimum=AudioRecord.getMinBufferSize(48000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT)
    check(minimum>0){"Microphone format unavailable"}
    val record=AudioRecord(MediaRecorder.AudioSource.CAMCORDER,48000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,maxOf(minimum*4,16384))
    check(record.state==AudioRecord.STATE_INITIALIZED){"Microphone initialization failed"}
    val format=MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC,48000,1).apply { setInteger(MediaFormat.KEY_AAC_PROFILE,MediaCodecInfo.CodecProfileLevel.AACObjectLC);setInteger(MediaFormat.KEY_BIT_RATE,128000);setInteger(MediaFormat.KEY_MAX_INPUT_SIZE,4096) }
    val codec=MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    try { codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);codec.start() }
    catch(t: Throwable){record.release();codec.release();throw t}
    microphone=record;aac=codec
  }
  private fun beginAudio() {
    audioRunning=true
    audioThread=Thread({
      val record=microphone!!;val codec=aac!!;val data=ByteArray(2048);val timestamp=AudioTimestamp()
      var sampleCount=0L;var firstSampleNs=0L
      try {
        record.startRecording();check(record.recordingState==AudioRecord.RECORDSTATE_RECORDING){"Microphone did not start"}
        while(audioRunning){ val read=record.read(data,0,data.size,AudioRecord.READ_BLOCKING);if(read<=0&&!audioRunning)break;check(read>0){"Microphone read failed"}
          if(firstSampleNs==0L)firstSampleNs=System.nanoTime()-read/2*1_000_000_000L/48000
          // AudioRecord timestamps relate sample position to the same MONOTONIC clock as video.
          val packetNs=if(record.getTimestamp(timestamp,AudioTimestamp.TIMEBASE_MONOTONIC)==AudioRecord.SUCCESS)
            timestamp.nanoTime+(sampleCount-timestamp.framePosition)*1_000_000_000L/48000 else firstSampleNs+sampleCount*1_000_000_000L/48000
          sampleCount+=read/2
          if(startNs>0&&packetNs>=startNs){val slot=codec.dequeueInputBuffer(10000);check(slot>=0){"Audio encoder stalled"}
            codec.getInputBuffer(slot)!!.apply { clear();put(data,0,read) };codec.queueInputBuffer(slot,0,read,(packetNs-startNs)/1000,0) }
          drainAudio(codec,false)
        }
        val slot=codec.dequeueInputBuffer(100000)
        check(slot>=0){"Audio encoder finalization stalled"}
        codec.queueInputBuffer(slot,0,0,maxOf(0,(System.nanoTime()-startNs)/1000),MediaCodec.BUFFER_FLAG_END_OF_STREAM)
        drainAudio(codec,true)
      }catch(t: Throwable){handler.post { failure=t.message;finish("audio") }}
      finally { runCatching { record.stop() };runCatching { record.release() };runCatching { codec.stop() };runCatching { codec.release() };handler.post { microphone=null;aac=null } }
    },"DualZenAudio").apply { start() }
  }
  private fun drainAudio(codec: MediaCodec,eos: Boolean) {
    val info=MediaCodec.BufferInfo();val deadline=System.nanoTime()+1_000_000_000
    while(true){val index=codec.dequeueOutputBuffer(info,if(eos)10000 else 0)
      when {index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED->{val format=codec.outputFormat;handler.post { sinks.forEach { it.audioFormat(format) } }}
        index>=0->{val end=info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM!=0
          if(info.size>0&&info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG==0){check(pendingAudio.incrementAndGet()<=64){"Audio queue limit exceeded"}
            val buffer=codec.getOutputBuffer(index)!!;buffer.position(info.offset);buffer.limit(info.offset+info.size)
            val copy=ByteArray(info.size);buffer.get(copy);val pts=info.presentationTimeUs;val flags=info.flags
            handler.post { try { sinks.forEach { it.audio(copy,pts,flags) } }catch(t: Throwable){failure=t.message;finish("audio")}finally{pendingAudio.decrementAndGet()} }
          }
          codec.releaseOutputBuffer(index,false);if(end)return }
        !eos->return
        System.nanoTime()>deadline->error("Audio encoder finalization timed out")
      }
    }
  }
  fun stop(): String {
    val latch=CountDownLatch(1);handler.post { finish("manual") { latch.countDown() } };latch.await();return lastResult
  }
  private val completions=mutableListOf<()->Unit>()
  fun finish(reason: String,completion: (()->Unit)?=null) {
    completion?.let { completions.add(it) }
    if(stopping)return
    if(sinks.isEmpty()){val callbacks=completions.toList();completions.clear();callbacks.forEach { it() };return}
    stopping=true;handler.removeCallbacks(poll);audioRunning=false
    // Join off the GL thread: encoded audio packets must be allowed to drain into the muxers first.
    Thread({runCatching { microphone?.stop() };runCatching { audioThread?.join(2500) };if(audioThread?.isAlive==true)failure="Audio finalization timed out";handler.post {
      val outputs=JSONArray();val duration=if(frames>0)lastPTS/1e6+1.0/config.optInt("fps",30) else 0.0
      sinks.forEach { sink ->
        var ready=false;var error: String?=null
        try { sink.codec.signalEndOfInputStream();sink.drain(true);sink.release(true);ready=frames>0&&sink.videoSamples>0&&sink.audioSamples>0 }
        catch(t: Throwable){error=t.message;runCatching { sink.release(false) }}
        outputs.put(JSONObject().put("kind",if(sink.portrait)"portrait" else "landscape").put("filename",sink.file.name)
          .put("width",sink.width).put("height",sink.height).put("bytes",sink.file.length()).put("bitrate",sink.bitrate).put("ready",ready)
          .put("keyframes",JSONArray(sink.keyframes)).apply { if(!ready)put("error",error?:failure?:"Video was not finalized") })
      }
      lastResult=JSONObject().put("id",config.optString("id")).put("duration",duration).put("outputs",outputs)
        .put("reason",reason).put("frames",frames).put("dropped",dropped).apply { failure?.let { put("error",it) } }.toString()
      // Persist finalized files before the JS runtime handles the completion event.
      val result=JSONObject(lastResult)
      try {
        val media=JSONObject().put("id",config.getString("id")).put("projectId",config.optString("projectId","default")).put("mediaType","video")
          .put("createdAt",config.optLong("createdAt")).put("settings",config.getJSONObject("settings")).put("duration",duration)
          .put("outputs",outputs).put("trim",JSONObject.NULL).put("exports",JSONArray()).put("reason",reason)
          .apply { failure?.let { put("error",it) } }
        val manifest=android.util.AtomicFile(File(localFile(config.getString("directory")),"manifest.json"))
        val stream=manifest.startWrite()
        try { stream.write(media.toString().toByteArray(Charsets.UTF_8));manifest.finishWrite(stream) }
        catch(t: Throwable){manifest.failWrite(stream);throw t}
      }catch(t: Throwable){result.put("error","Media metadata could not be saved: ${t.message}")}
      lastResult=result.toString()
      sinks.clear();stopping=false;startNs=0
      val callbacks=completions.toList();completions.clear();callbacks.forEach { it() };onStopped?.invoke(lastResult)
    } },"DualZenFinalize").start()
  }
  fun localFile(uri: String): File {
    val url=java.net.URI(uri);require(url.scheme=="file"){"Invalid local file"};val file=File(url).canonicalFile
    val root=File(context!!.filesDir,"../files/DualZen").canonicalFile
    // Expo Paths.document on Android is filesDir.
    require(file.path.startsWith(root.path+File.separator)){"File is outside project storage"};return file
  }
  private class VideoSink(val file: File,val width: Int,val height: Int,val fps: Int,val portrait: Boolean,val position: Double) {
    val bitrate=maxOf(4_000_000,(width.toDouble()*height*fps*0.18).toInt())
    val codec: MediaCodec
    val surface: Surface
    var egl: EGLSurface=EGL14.EGL_NO_SURFACE
    private val muxer=MediaMuxer(file.path,MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    private var videoTrack=-1;private var audioTrack=-1;private var muxing=false;private var released=false
    private val waiting=mutableListOf<Packet>()
    var lastKeyRequest=-1L;var videoSamples=0;var audioSamples=0
    val keyframes=mutableListOf<Double>()
    private data class Packet(val video: Boolean,val bytes: ByteArray,val pts: Long,val flags: Int)
    init {
      val format=MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC,width,height).apply {
        setInteger(MediaFormat.KEY_COLOR_FORMAT,MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        setInteger(MediaFormat.KEY_BIT_RATE,bitrate);setInteger(MediaFormat.KEY_FRAME_RATE,fps);setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,2)
        setInteger(MediaFormat.KEY_COLOR_STANDARD,MediaFormat.COLOR_STANDARD_BT709);setInteger(MediaFormat.KEY_COLOR_TRANSFER,MediaFormat.COLOR_TRANSFER_SDR_VIDEO)
        setInteger(MediaFormat.KEY_COLOR_RANGE,MediaFormat.COLOR_RANGE_LIMITED);if(Build.VERSION.SDK_INT>=29)setInteger(MediaFormat.KEY_MAX_B_FRAMES,0)
      }
      val encoder=MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.firstOrNull { info ->
        info.isEncoder && (Build.VERSION.SDK_INT<29||info.isHardwareAccelerated) && info.supportedTypes.any { it.equals("video/avc",true) } &&
          runCatching { val caps=info.getCapabilitiesForType("video/avc");caps.maxSupportedInstances>=2&&caps.isFormatSupported(format) }.getOrDefault(false)
      }?.name?:error("Hardware encoder does not support two outputs at these dimensions/FPS")
      codec=MediaCodec.createByCodecName(encoder)
      try { codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);surface=codec.createInputSurface();codec.start() }
      catch(t: Throwable){codec.release();muxer.release();throw t}
    }
    fun audioFormat(format: MediaFormat) { if(audioTrack<0){audioTrack=muxer.addTrack(format);tryStart()} }
    private fun tryStart() { if(videoTrack>=0&&audioTrack>=0&&!muxing){muxer.start();muxing=true;val packets=waiting.toList();waiting.clear();packets.forEach { write(it) }} }
    fun audio(bytes: ByteArray,pts: Long,flags: Int) { packet(Packet(false,bytes,pts,flags)) }
    private fun packet(packet: Packet) {
      if(muxing)write(packet) else {check(waiting.size<90){"Muxer startup queue exceeded"};waiting.add(packet)}
    }
    private fun write(packet: Packet) {
      if(released)return
      val info=MediaCodec.BufferInfo().apply { set(0,packet.bytes.size,packet.pts,packet.flags) }
      muxer.writeSampleData(if(packet.video)videoTrack else audioTrack,ByteBuffer.wrap(packet.bytes),info)
      if(packet.video){videoSamples++;if(packet.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME!=0)keyframes.add(packet.pts/1e6)} else audioSamples++
    }
    fun drain(eos: Boolean) {
      val info=MediaCodec.BufferInfo();val deadline=System.nanoTime()+2_000_000_000
      while(true){val index=codec.dequeueOutputBuffer(info,if(eos)10000 else 0)
        when {index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED->{videoTrack=muxer.addTrack(codec.outputFormat);tryStart()}
          index>=0->{val end=info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM!=0
            if(info.size>0&&info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG==0){val buffer=codec.getOutputBuffer(index)!!
              buffer.position(info.offset);buffer.limit(info.offset+info.size);val copy=ByteArray(info.size);buffer.get(copy)
              packet(Packet(true,copy,info.presentationTimeUs,info.flags)) }
            codec.releaseOutputBuffer(index,false);if(end)return }
          !eos->return
          System.nanoTime()>deadline->error("Video encoder finalization timed out")
        }
      }
    }
    fun release(success: Boolean) {
      if(released)return
      released=true
      var problem: Throwable?=null
      try { if(muxing)muxer.stop() }catch(t: Throwable){problem=t}
      finally { muxer.release();runCatching { codec.stop() };codec.release();surface.release();if(egl!=EGL14.EGL_NO_SURFACE)EGL14.eglDestroySurface(display,egl);waiting.clear() }
      if(success)problem?.let { throw it }
    }
  }
}
