const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs/promises')
const path = require('path')

/**
 * Fixes iOS build errors when using @react-native-firebase with `use_frameworks! :linkage => :static`.
 *
 * Two patches are applied to the generated Podfile:
 *
 * 1. `$RNFirebaseAsStaticFramework = true` — tells each RNFB pod spec to set
 *    `static_framework = true`.
 *
 * 2. `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` scoped to RNFB targets,
 *    injected AFTER `react_native_post_install` to avoid being overridden by it.
 *    This suppresses the `-Werror,-Wnon-modular-include-in-framework-module` clang error
 *    caused by RNFB headers importing non-modular React Native headers.
 *
 * Root cause (Expo SDK 54+ / RN 0.81+): RN introduced experimental precompiled iOS frameworks
 * whose headers are not fully modular, which triggers strict clang enforcement when combined
 * with `use_frameworks! :linkage => :static`.
 *
 * `expo-build-properties` `forceStaticLinking` handles the primary fix for the listed pods;
 * this plugin provides the $RNFirebaseAsStaticFramework global and a scoped clang fallback.
 *
 * This plugin runs during `expo prebuild` — no manual ios/ edits needed.
 */
const withRNFirebaseStaticFramework = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile')
      let contents = await fs.readFile(podfilePath, 'utf8')

      // 1. Inject $RNFirebaseAsStaticFramework = true before the target block
      if (!contents.includes('$RNFirebaseAsStaticFramework')) {
        contents = contents.replace(
          /^(target\s+['"])/m,
          `$RNFirebaseAsStaticFramework = true\n\n$1`
        )
      }

      // 2. Inject CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES scoped to RNFB targets,
      //    placed AFTER react_native_post_install so it is not overridden by it.
      const rnfbTargets = ['RNFBApp', 'RNFBAnalytics']
      const clangSnippet = `
    rnfb_targets = %w[${rnfbTargets.join(' ')}]
    installer.pods_project.targets.each do |target|
      if rnfb_targets.include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end`

      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        // Insert after the closing paren of react_native_post_install(...) call
        contents = contents.replace(
          /(react_native_post_install\([\s\S]*?\)\s*\n)/,
          `$1${clangSnippet}\n`
        )
      }

      await fs.writeFile(podfilePath, contents)
      return config
    },
  ])
}

module.exports = withRNFirebaseStaticFramework
