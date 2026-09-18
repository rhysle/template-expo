package expo.modules.dualrecorder

import android.content.Context
import android.graphics.SurfaceTexture
import android.view.TextureView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class DualPreview(context: Context,appContext: AppContext) : ExpoView(context,appContext),TextureView.SurfaceTextureListener {
  @Volatile var channel=0
  @Volatile var portrait=true
  @Volatile var position=0.5
  @Volatile var mirrored=false
  private val texture=TextureView(context).apply { surfaceTextureListener=this@DualPreview;isOpaque=true }
  init { addView(texture,LayoutParams(LayoutParams.MATCH_PARENT,LayoutParams.MATCH_PARENT)) }
  override fun onLayout(changed: Boolean,l: Int,t: Int,r: Int,b: Int) { texture.layout(0,0,r-l,b-t) }
  override fun onSurfaceTextureAvailable(surface: SurfaceTexture,width: Int,height: Int) { DualEngine.previewAvailable(this,surface) }
  override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture,width: Int,height: Int) {}
  override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
  override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean { DualEngine.previewGone(this,surface);return false }
}
