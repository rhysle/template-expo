import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { AnalyticsGeneralEvents, trackEvent } from '@/services/firebase/analytics'
import { recordError } from '@/services/sentry'
import { createThemedStyles, useThemedStyles } from '@/theme'

import { Button } from './Button'
import { Text } from './Text'

// ── Fallback UI ───────────────────────────────────────────────────────────────
// Separate named component (not inline) so it can call hooks.

interface ErrorFallbackProps {
  onRetry: () => void
}

const ErrorFallback = ({ onRetry }: ErrorFallbackProps) => {
  const { t } = useTranslation()
  const styles = useThemedStyles(createStyles)

  return (
    <View style={styles.container}>
      <Text variant="title" weight="bold" align="center">
        {t('errorBoundary.title')}
      </Text>
      <Text variant="body" tone="secondary" align="center" style={styles.message}>
        {t('errorBoundary.message')}
      </Text>
      <Button
        label={t('common.button.retry')}
        variant="primary"
        size="md"
        onPress={onRetry}
        style={styles.button}
      />
    </View>
  )
}

// ── ErrorBoundary class ───────────────────────────────────────────────────────
// The only class component in the codebase.
// getDerivedStateFromError / componentDidCatch have no Hook equivalents.
// Do NOT refactor to a function component.

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordError(error, `componentStack: ${info.componentStack?.slice(0, 300) ?? ''}`)
    trackEvent(AnalyticsGeneralEvents.ERROR_BOUNDARY_TRIGGERED, {
      error_message: error.message.slice(0, 100),
    })
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = createThemedStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing['2xl'],
    backgroundColor: t.colors.background.base,
  },
  message: {
    marginTop: t.spacing.md,
    marginBottom: t.spacing['2xl'],
  },
  button: {
    alignSelf: 'stretch',
  },
}))
