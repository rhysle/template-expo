import { CapsuleNavigationBar } from '@shared/core/components/base'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { CameraIcon, GearIcon, SquaresFourIcon, VideoCameraIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import type { MediaType } from '@/services/camera/types'
import { useCameraState } from '@/stores/features/camera'

export function CaptureTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation()
  const { mediaType, phase, sessionStrategy, setMediaType, setPhase } = useCameraState()
  const focusedRoute = state.routes[state.index]
  const captureFocused = focusedRoute?.name === 'index'
  const disabled = phase !== 'idle'
  const navigateToCapture = (nextMediaType: MediaType) => {
    if (disabled) return
    if (mediaType !== nextMediaType && sessionStrategy === 'mode-specific') setPhase('switching')
    setMediaType(nextMediaType)
    if (!captureFocused) navigation.navigate('index')
  }
  const routeItem = (name: 'projects' | 'settings', icon: typeof SquaresFourIcon) => {
    const route = state.routes.find((item) => item.name === name)
    if (!route) throw new Error(`Missing tab route: ${name}`)
    const selected = focusedRoute?.key === route.key
    const options = descriptors[route.key].options
    return {
      key: route.key,
      label: options.tabBarAccessibilityLabel ?? options.title ?? route.name,
      selected,
      disabled: disabled && !selected,
      renderIcon: (color: string, size: number) => {
        const Icon = icon
        return <Icon color={color} size={size} weight="regular" />
      },
      onPress: () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })
        if (!selected && !disabled && !event.defaultPrevented) navigation.navigate(route.name)
      },
      onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
    }
  }

  return (
    <CapsuleNavigationBar
      items={[
        {
          key: 'capture-video',
          label: t('camera.videoTitle'),
          selected: captureFocused && mediaType === 'video',
          disabled: disabled && !(captureFocused && mediaType === 'video'),
          renderIcon: (color, size) => (
            <VideoCameraIcon color={color} size={size} weight="regular" />
          ),
          onPress: () => navigateToCapture('video'),
        },
        {
          key: 'capture-photo',
          label: t('camera.photoTitle'),
          selected: captureFocused && mediaType === 'photo',
          disabled: disabled && !(captureFocused && mediaType === 'photo'),
          renderIcon: (color, size) => <CameraIcon color={color} size={size} weight="regular" />,
          onPress: () => navigateToCapture('photo'),
        },
        routeItem('projects', SquaresFourIcon),
        routeItem('settings', GearIcon),
      ]}
    />
  )
}
