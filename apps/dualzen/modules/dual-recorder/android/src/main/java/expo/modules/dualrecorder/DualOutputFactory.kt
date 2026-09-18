package com.margelo.nitro.dualrecorder

import com.margelo.nitro.camera.*
import expo.modules.dualrecorder.DualOutput

class DualOutputFactory : HybridDualOutputFactorySpec() {
  override fun createOutput(channel: Double, longEdge: Double, hdr: Boolean): HybridCameraOutputSpec =
    DualOutput(channel.toInt(), longEdge.toInt(), hdr)
}
