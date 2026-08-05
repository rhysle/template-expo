import type { Command } from './types'

type FindingKind = 'ok' | 'change' | 'error' | 'info'

export class Reporter {
  private changes = 0
  private errors = 0

  constructor(readonly command: Command) {}

  private write(kind: FindingKind, message: string): void {
    const marker = { ok: '✓', change: '+', error: '!', info: '•' }[kind]
    console.log(`  ${marker} ${message}`)
  }

  section(title: string): void {
    console.log(`\n${title}`)
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
      this.command === 'apply' || this.command === 'activate' ? message : `Would ${message}`
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
    if (this.command === 'plan') {
      console.log(
        this.changes === 0 ? 'No changes required.' : `${this.changes} change(s) planned.`
      )
    } else if (this.command === 'verify') {
      console.log('Monetization configuration verified.')
    } else {
      console.log(`${this.changes} change(s) applied.`)
    }
  }
}
