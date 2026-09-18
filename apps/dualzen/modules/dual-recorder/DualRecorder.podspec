require 'json'
Pod::Spec.new do |s|
  s.name = 'DualRecorder'
  s.version = '1.0.0'
  s.summary = 'DualZen concurrent crop recording and independent photo export'
  s.description = s.summary
  s.author = 'Rhysle'
  s.homepage = 'https://rhysle.com'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'DualRecorderCore'
  s.source_files = ['ios/*.swift', 'ios/bridge/*.h']
  s.public_header_files = 'ios/bridge/DZRecorder.h'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20' }
  install_modules_dependencies(s)
end
