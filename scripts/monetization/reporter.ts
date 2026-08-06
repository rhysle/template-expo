import type { Command } from './types'

type FindingKind = 'ok' | 'change' | 'error' | 'info'

interface ReporterOptions {
  color?: boolean
}

const ANSI = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  green: '\u001B[32m',
  brightRed: '\u001B[91m',
  brightYellow: '\u001B[93m',
  brightCyan: '\u001B[96m',
} as const

const terminalSupportsColor = (): boolean => {
  if ('NO_COLOR' in process.env || process.env.FORCE_COLOR === '0') return false
  if (process.env.FORCE_COLOR !== undefined) return true
  return process.stdout.isTTY === true && process.env.TERM !== 'dumb'
}

export class Reporter {
  private changes = 0
  private errors = 0
  private readonly color: boolean

  constructor(
    readonly command: Command,
    options: ReporterOptions = {}
  ) {
    this.color = options.color ?? terminalSupportsColor()
  }

  private styled(value: string, ...styles: string[]): string {
    return this.color ? `${styles.join('')}${value}${ANSI.reset}` : value
  }

  private write(kind: FindingKind, message: string): void {
    const marker = { ok: '✓', change: '+', error: '!', info: '•' }[kind]
    if (kind === 'change') {
      console.log(this.styled(`  ${marker} ${message}`, ANSI.bold, ANSI.brightYellow))
      return
    }
    if (kind === 'error') {
      console.log(this.styled(`  ${marker} ${message}`, ANSI.bold, ANSI.brightRed))
      return
    }
    const markerColor = kind === 'ok' ? ANSI.green : ANSI.brightCyan
    console.log(`  ${this.styled(marker, markerColor)} ${message}`)
  }

  section(title: string): void {
    console.log(`\n${this.styled(title, ANSI.bold)}`)
  }

  ok(message: string): void {
    this.write('ok', message)
  }

  info(message: string): void {
    this.write('info', message)
  }

  change(message: string): void {
    this.changes += 1
    this.write(
      'change',
      this.command === 'apply' || this.command === 'activate' || this.command === 'prices-apply'
        ? message
        : `Would ${message}`
    )
  }

  error(message: string): void {
    this.errors += 1
    this.write('error', message)
  }

  async ensure<T>(
    message: string,
    current: T | undefined,
    apply: () => Promise<T>
  ): Promise<T | undefined> {
    if (current) {
      this.ok(message)
      return current
    }

    if (this.command === 'apply') {
      const created = await apply()
      this.change(message)
      return created
    }

    if (this.command === 'verify') {
      this.error(`Missing: ${message}`)
    } else {
      this.change(`create ${message}`)
    }
    return undefined
  }

  finish(): void {
    console.log('')
    if (this.errors > 0) {
      throw new Error(`${this.errors} monetization configuration issue(s) found`)
    }
    if (this.command === 'plan' || this.command === 'prices-plan') {
      const summary =
        this.changes === 0 ? 'No changes required.' : `${this.changes} change(s) planned.`
      console.log(
        this.changes === 0
          ? this.styled(summary, ANSI.bold, ANSI.green)
          : this.styled(summary, ANSI.bold, ANSI.brightYellow)
      )
    } else if (this.command === 'verify' || this.command === 'prices-verify') {
      console.log(this.styled('Monetization configuration verified.', ANSI.bold, ANSI.green))
    } else {
      const summary = `${this.changes} change(s) applied.`
      console.log(
        this.styled(summary, ANSI.bold, this.changes === 0 ? ANSI.green : ANSI.brightYellow)
      )
    }
  }
}
