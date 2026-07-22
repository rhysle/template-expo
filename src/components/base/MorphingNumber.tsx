import { useEffect, useLayoutEffect, useState } from 'react'
import { type ColorValue, type StyleProp, StyleSheet, type TextStyle, View } from 'react-native'
import Animated, { Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated'
import Svg, { Text as SvgText } from 'react-native-svg'

import { useTheme } from '@/theme'

const DEFAULT_DURATION = 90
const DEFAULT_OUTLINE_WIDTH = 2
const DIGIT_WIDTH_RATIO = 0.64
const SEPARATOR_WIDTH_RATIO = 0.34
const BASELINE_RATIO = 0.82

const DECIMAL_DIGIT_PATTERN = /^\p{Decimal_Number}$/u

interface GlyphToken {
  glyph: string
  id: string
  isDigit: boolean
}

interface TransitionState {
  direction: 1 | -1
  formattedValue: string
  previousTokens: GlyphToken[]
  revision: number
  tokens: GlyphToken[]
  value: number
}

export interface MorphingNumberProps {
  value: number
  formattedValue: string
  textStyle?: StyleProp<TextStyle>
  color?: ColorValue
  outlineColor?: ColorValue
  outlineWidth?: number
  duration?: number
}

interface OutlinedGlyphProps {
  color: ColorValue
  fontFamily?: string
  fontSize: number
  fontStyle: NonNullable<TextStyle['fontStyle']>
  fontWeight: NonNullable<TextStyle['fontWeight']>
  glyph: string
  height: number
  outlineColor: ColorValue
  outlineWidth: number
  width: number
}

const tokenizeFormattedNumber = (formattedValue: string): GlyphToken[] => {
  let digitPosition = 0
  const separatorOccurrences = new Map<string, number>()

  return Array.from(formattedValue)
    .reverse()
    .map((glyph) => {
      const isDigit = DECIMAL_DIGIT_PATTERN.test(glyph)

      if (isDigit) {
        const token = { glyph, id: `digit-${digitPosition}`, isDigit }
        digitPosition += 1
        return token
      }

      const separatorKey = `${digitPosition}-${glyph}`
      const occurrence = separatorOccurrences.get(separatorKey) ?? 0
      separatorOccurrences.set(separatorKey, occurrence + 1)

      return {
        glyph,
        id: `separator-${separatorKey}-${occurrence}`,
        isDigit,
      }
    })
    .reverse()
}

const OutlinedGlyph = ({
  color,
  fontFamily,
  fontSize,
  fontStyle,
  fontWeight,
  glyph,
  height,
  outlineColor,
  outlineWidth,
  width,
}: OutlinedGlyphProps) => {
  const baseline = (height - fontSize) / 2 + fontSize * BASELINE_RATIO
  const textProps = {
    fontFamily,
    fontSize,
    fontStyle,
    fontWeight,
    textAnchor: 'middle' as const,
    x: width / 2,
    y: baseline,
  }

  return (
    <Svg accessible={false} height={height} width={width}>
      <SvgText
        {...textProps}
        fill="none"
        stroke={outlineColor}
        strokeLinejoin="round"
        strokeWidth={outlineWidth * 2}>
        {glyph}
      </SvgText>
      <SvgText {...textProps} fill={color}>
        {glyph}
      </SvgText>
    </Svg>
  )
}

export function MorphingNumber({
  value,
  formattedValue,
  textStyle,
  color,
  outlineColor,
  outlineWidth = DEFAULT_OUTLINE_WIDTH,
  duration = DEFAULT_DURATION,
}: MorphingNumberProps) {
  const theme = useTheme()
  const reducedMotion = useReducedMotion()
  const [transition, setTransition] = useState<TransitionState>(() => {
    const tokens = tokenizeFormattedNumber(formattedValue)

    return {
      direction: 1,
      formattedValue,
      previousTokens: tokens,
      revision: 0,
      tokens,
      value,
    }
  })
  const resolvedStyle = StyleSheet.flatten(textStyle) ?? {}
  const fontSize = typeof resolvedStyle.fontSize === 'number' ? resolvedStyle.fontSize : 28
  const lineHeight =
    typeof resolvedStyle.lineHeight === 'number'
      ? resolvedStyle.lineHeight
      : Math.ceil(fontSize * 1.1)
  const fontFamily = resolvedStyle.fontFamily ?? theme.typography.fontFamily.bold
  const fontWeight = resolvedStyle.fontWeight ?? theme.typography.weights.bold
  const fontStyle = resolvedStyle.fontStyle ?? 'normal'
  const fillColor = color ?? resolvedStyle.color ?? theme.colors.text.accent
  const strokeColor = outlineColor ?? theme.colors.text.inverse
  const travelDistance = Math.min(lineHeight * 0.16, 10)
  const previousTokenMap = new Map(transition.previousTokens.map((token) => [token.id, token]))
  const currentTokenMap = new Map(transition.tokens.map((token) => [token.id, token]))
  const displayTokens =
    transition.tokens.length >= transition.previousTokens.length
      ? transition.tokens
      : transition.previousTokens

  const incomingAnimation = new Keyframe({
    0: { opacity: 0.35, transform: [{ translateY: transition.direction * travelDistance }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(duration)
    .reduceMotion(ReduceMotion.System)
  const outgoingAnimation = new Keyframe({
    0: { opacity: 1, transform: [{ translateY: 0 }] },
    100: { opacity: 0, transform: [{ translateY: -transition.direction * travelDistance }] },
  })
    .duration(duration)
    .reduceMotion(ReduceMotion.System)

  useLayoutEffect(() => {
    setTransition((currentTransition) => {
      if (
        currentTransition.value === value &&
        currentTransition.formattedValue === formattedValue
      ) {
        return currentTransition
      }

      return {
        direction: value >= currentTransition.value ? 1 : -1,
        formattedValue,
        previousTokens: currentTransition.tokens,
        revision: currentTransition.revision + 1,
        tokens: tokenizeFormattedNumber(formattedValue),
        value,
      }
    })
  }, [formattedValue, value])

  useEffect(() => {
    if (transition.previousTokens === transition.tokens) return

    const cleanupTimer = setTimeout(() => {
      setTransition((currentTransition) =>
        currentTransition.revision === transition.revision
          ? { ...currentTransition, previousTokens: currentTransition.tokens }
          : currentTransition
      )
    }, duration)

    return () => clearTimeout(cleanupTimer)
  }, [duration, transition.previousTokens, transition.revision, transition.tokens])

  const renderGlyph = (token: GlyphToken) => {
    const widthRatio = token.isDigit ? DIGIT_WIDTH_RATIO : SEPARATOR_WIDTH_RATIO
    const width = Math.ceil(fontSize * widthRatio + outlineWidth * 2)

    return (
      <OutlinedGlyph
        color={fillColor}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontStyle={fontStyle}
        fontWeight={fontWeight}
        glyph={token.glyph}
        height={lineHeight}
        outlineColor={strokeColor}
        outlineWidth={outlineWidth}
        width={width}
      />
    )
  }

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[styles.row, { height: lineHeight }]}>
      {displayTokens.map(({ id }) => {
        const currentToken = currentTokenMap.get(id)
        const previousToken = previousTokenMap.get(id)
        const token = currentToken ?? previousToken

        if (!token) return null

        const widthRatio = token.isDigit ? DIGIT_WIDTH_RATIO : SEPARATOR_WIDTH_RATIO
        const width = Math.ceil(fontSize * widthRatio + outlineWidth * 2)
        const glyphChanged =
          currentToken !== undefined &&
          previousToken !== undefined &&
          currentToken.glyph !== previousToken.glyph
        const tokenAdded = currentToken !== undefined && previousToken === undefined
        const tokenRemoved = currentToken === undefined && previousToken !== undefined

        if (reducedMotion) {
          return currentToken ? (
            <View key={id} style={{ height: lineHeight, width }}>
              {renderGlyph(currentToken)}
            </View>
          ) : null
        }

        return (
          <Animated.View
            key={tokenRemoved ? `${id}-removed-${transition.revision}` : id}
            entering={tokenAdded ? incomingAnimation : tokenRemoved ? outgoingAnimation : undefined}
            style={[
              styles.slot,
              { height: lineHeight, width },
              tokenRemoved && styles.outgoingLayer,
            ]}>
            {glyphChanged && previousToken ? (
              <Animated.View
                key={`outgoing-${id}-${previousToken.glyph}-${transition.revision}`}
                entering={outgoingAnimation}
                style={[styles.glyphLayer, styles.outgoingLayer]}>
                {renderGlyph(previousToken)}
              </Animated.View>
            ) : null}
            {currentToken ? (
              <Animated.View
                key={`current-${id}-${currentToken.glyph}`}
                entering={glyphChanged ? incomingAnimation : undefined}
                style={styles.glyphLayer}>
                {renderGlyph(currentToken)}
              </Animated.View>
            ) : previousToken ? (
              <View style={styles.glyphLayer}>{renderGlyph(previousToken)}</View>
            ) : null}
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    direction: 'ltr',
    flexDirection: 'row',
  },
  slot: {
    overflow: 'hidden',
    opacity: 1,
    position: 'relative',
    transform: [{ translateY: 0 }],
  },
  glyphLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    opacity: 1,
    position: 'absolute',
    right: 0,
    top: 0,
    transform: [{ translateY: 0 }],
  },
  outgoingLayer: {
    opacity: 0,
  },
})
