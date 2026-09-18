#include "DualRecorderOnLoad.hpp"
#include <jni.h>
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::dualrecorder::initialize(vm);
}
