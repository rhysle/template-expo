export const iconSizes = {
  xs: 12, // micro badges, small lock indicators
  sm: 16, // chevrons, nav items, checkmarks
  md: 20, // settings rows, feature icons
  lg: 24, // tab bar, close buttons, keyboards
  xl: 40, // empty states
  hero: 80, // onboarding hero
} as const

export type IconSize = keyof typeof iconSizes
