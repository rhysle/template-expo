import { Platform, type ViewStyle } from 'react-native'

import { withAlpha } from '@/utils/color'

const shadowDefinitions = {
  xs: { offsetY: 1, blurRadius: 2, opacity: 0.05, elevation: 1 },
  sm: { offsetY: 4, blurRadius: 8, opacity: 0.08, elevation: 2 },
  md: { offsetY: 8, blurRadius: 16, opacity: 0.1, elevation: 4 },
  lg: { offsetY: 12, blurRadius: 24, opacity: 0.12, elevation: 6 },
  xl: { offsetY: 20, blurRadius: 40, opacity: 0.16, elevation: 10 },
} as const

type ShadowDefinition = (typeof shadowDefinitions)[keyof typeof shadowDefinitions]

function createShadowStyle(color: string, definition: ShadowDefinition): ViewStyle {
  if (Platform.OS === 'android' && Number(Platform.Version) < 28) {
    return {
      elevation: definition.elevation,
      shadowColor: color,
    }
  }

  return {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: definition.offsetY,
        blurRadius: definition.blurRadius,
        spreadDistance: 0,
        color: withAlpha(color, definition.opacity),
      },
    ],
  }
}

export function createShadows(color: string) {
  return {
    xs: createShadowStyle(color, shadowDefinitions.xs),
    sm: createShadowStyle(color, shadowDefinitions.sm),
    md: createShadowStyle(color, shadowDefinitions.md),
    lg: createShadowStyle(color, shadowDefinitions.lg),
    xl: createShadowStyle(color, shadowDefinitions.xl),
  }
}

export type Shadows = ReturnType<typeof createShadows>
