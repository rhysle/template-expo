import * as ExpoHaptics from 'expo-haptics'

export const haptics = {
  light: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light),
  medium: () => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium),
  selection: () => ExpoHaptics.selectionAsync(),
}

export type HapticType = keyof typeof haptics
