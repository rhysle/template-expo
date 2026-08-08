import assert from 'node:assert/strict'
import test from 'node:test'

import { Reporter } from './reporter'

const captureLogs = (task: () => void): string[] => {
  const lines: string[] = []
  const original = console.log
  console.log = (value = '') => lines.push(String(value))
  try {
    task()
  } finally {
    console.log = original
  }
  return lines
}

test('Reporter highlights planned changes and their summary', () => {
  const lines = captureLogs(() => {
    const reporter = new Reporter('plan', { color: true })
    reporter.change('prepare Google weekly 3-days free-trial offer')
    reporter.finish()
  })

  assert.equal(
    lines[0],
    '\u001B[1m\u001B[93m  + Would prepare Google weekly 3-days free-trial offer\u001B[0m'
  )
  assert.equal(lines[2], '\u001B[1m\u001B[93m1 change(s) planned.\u001B[0m')
})

test('Reporter highlights errors and keeps plain output free of ANSI codes', () => {
  const colored = captureLogs(() => {
    new Reporter('verify', { color: true }).error('Missing: Google weekly free-trial offer')
  })
  assert.equal(
    colored[0],
    '\u001B[1m\u001B[91m  ! Missing: Google weekly free-trial offer\u001B[0m'
  )

  const plain = captureLogs(() => {
    new Reporter('plan', { color: false }).change(
      'prepare Google weekly 3-days free-trial offer'
    )
  })
  assert.equal(plain[0], '  + Would prepare Google weekly 3-days free-trial offer')
  assert.equal(plain[0].includes('\u001B'), false)
})
