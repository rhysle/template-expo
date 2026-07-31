import type { AnimationType, ButtonAnimationResult } from '../types'
import { useDarkenAnimation } from './useDarkenAnimation'
import { useOpacityAnimation } from './useOpacityAnimation'
import { useScaleAnimation } from './useScaleAnimation'

const noop = () => {}

const NONE_RESULT: ButtonAnimationResult = {
  outerStyle: {},
  overlayStyle: {},
  onPressIn: noop,
  onPressOut: noop,
}

export const useButtonAnimation = (
  type: AnimationType,
  overlayColor: string,
  overlayOpacity: number
): ButtonAnimationResult => {
  const scale = useScaleAnimation()
  const darken = useDarkenAnimation(overlayColor, overlayOpacity)
  const opacity = useOpacityAnimation()

  if (type === 'scale') return scale
  if (type === 'darken') return darken
  if (type === 'opacity') return opacity
  return NONE_RESULT
}
