Pod::Spec.new do |s|
  s.name = 'DualRecorderCore'
  s.version = '1.0.0'
  s.summary = 'DualZen native camera outputs and GPU encoders'
  s.description = s.summary
  s.author = 'Rhysle'
  s.homepage = 'https://rhysle.com'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true
  s.dependency 'VisionCamera'
  s.source_files = 'ios/core/*.{swift,mm}'
  load File.join(__dir__, 'nitrogen/generated/ios/DualRecorderCore+autolinking.rb')
  add_nitrogen_files(s)
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
