import type { AnimationType, ButtonAnimationResult } from '../types'
import { useDarkenAnimation } from './useDarkenAnimation'
import { useScaleAnimation } from './useScaleAnimation'

const noop = () => {}

const NONE_RESULT: ButtonAnimationResult = {
  outerStyle: {},
  overlayStyle: {},
  onPressIn: noop,
  onPressOut: noop,
  disableOpacity: false,
}

export const useButtonAnimation = (type: AnimationType): ButtonAnimationResult => {
  const scale = useScaleAnimation()
  const darken = useDarkenAnimation()

  if (type === 'scale') return scale
  if (type === 'darken') return darken
  return NONE_RESULT
}
