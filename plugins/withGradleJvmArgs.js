const { withGradleProperties } = require('expo/config-plugins')

const JVM_ARGS =
  '-Xmx6g -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'

const withGradleJvmArgs = (config) => {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    )
    if (existing) {
      existing.value = JVM_ARGS
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS })
    }
    return config
  })
}

module.exports = withGradleJvmArgs
