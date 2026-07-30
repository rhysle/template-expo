const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

config.resolver = {
  ...config.resolver,
  assetExts: Array.from(new Set([...(config.resolver?.assetExts ?? []), 'lottie'])),
}

if (process.env.NODE_ENV !== 'development') {
  const currentBlockList = config.resolver.blockList

  config.resolver.blockList = [
    ...(Array.isArray(currentBlockList)
      ? currentBlockList
      : currentBlockList
        ? [currentBlockList]
        : []),
    /[/\\]src[/\\]app[/\\]debug\.tsx$/,
  ]
}

module.exports = config
