import type { ReactNode } from 'react'

export interface OnboardingPageItem {
  key: string
  content: ReactNode
}

export type OnboardingAnimationType = 'fade' | 'slide'

export interface OnboardingFlowProps {
  pages: OnboardingPageItem[]
  swipeEnabled?: boolean
  animationType?: OnboardingAnimationType
  onComplete: () => void
  onSkip?: () => void
  onPageChange?: (pageIndex: number, pageKey: string) => void
}
