const { withAppDelegate } = require('expo/config-plugins')

const START_MARKER = '// @generated begin withSegmentedControlFont - expo prebuild'
const END_MARKER = '// @generated end withSegmentedControlFont'

function createAppearanceBlock(postScriptName) {
  const quotedPostScriptName = JSON.stringify(postScriptName)

  return [
    `    ${START_MARKER} (DO NOT MODIFY)`,
    `    let segmentedControlFont = UIFont(name: ${quotedPostScriptName}, size: 13) ?? UIFont.systemFont(ofSize: 13)`,
    '    let segmentedControlFontAttributes: [NSAttributedString.Key: Any] = [.font: segmentedControlFont]',
    '    UISegmentedControl.appearance().setTitleTextAttributes(segmentedControlFontAttributes, for: .normal)',
    '    UISegmentedControl.appearance().setTitleTextAttributes(segmentedControlFontAttributes, for: .selected)',
    `    ${END_MARKER}`,
  ].join('\n')
}

function withSegmentedControlFont(config, { postScriptName }) {
  if (typeof postScriptName !== 'string' || postScriptName.trim().length === 0) {
    throw new Error('withSegmentedControlFont requires a non-empty postScriptName.')
  }

  return withAppDelegate(config, (config) => {
    const { language } = config.modResults
    let { contents } = config.modResults

    if (language !== 'swift') {
      throw new Error(
        `withSegmentedControlFont only supports Swift AppDelegate files; received ${language}.`
      )
    }

    const appearanceBlock = createAppearanceBlock(postScriptName)
    const startIndex = contents.indexOf(START_MARKER)
    const endIndex = contents.indexOf(END_MARKER, startIndex)

    if (startIndex !== -1 && endIndex !== -1) {
      contents = `${contents.slice(0, startIndex)}${appearanceBlock}${contents.slice(endIndex + END_MARKER.length)}`
    } else {
      const launchMethod = contents.match(
        /((?:public\s+)?(?:override\s+)?func\s+application\([\s\S]*?didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{)/
      )

      if (!launchMethod) {
        throw new Error(
          'Could not find application(_:didFinishLaunchingWithOptions:) in AppDelegate.swift.'
        )
      }

      contents = contents.replace(launchMethod[0], `${launchMethod[0]}\n${appearanceBlock}`)
    }

    if (!/^\s*(?:internal\s+)?import UIKit\s*$/m.test(contents)) {
      contents = `import UIKit\n${contents}`
    }

    config.modResults.contents = contents
    return config
  })
}

module.exports = withSegmentedControlFont
