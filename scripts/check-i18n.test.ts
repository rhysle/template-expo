import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

type NestedRecord = { [key: string]: string | NestedRecord }

const SCRIPT_PATH = path.resolve(__dirname, 'check-i18n.ts')
const PROJECT_ROOT = path.resolve(__dirname, '..')

function writeJson(filePath: string, value: NestedRecord): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function runReleaseFix(locale: NestedRecord): {
  root: string
  result: ReturnType<typeof spawnSync>
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-i18n-'))
  const scriptsDir = path.join(root, 'scripts')
  const localesDir = path.join(root, 'src/i18n/locales')

  fs.mkdirSync(scriptsDir, { recursive: true })
  fs.mkdirSync(localesDir, { recursive: true })
  fs.copyFileSync(SCRIPT_PATH, path.join(scriptsDir, 'check-i18n.ts'))
  fs.writeFileSync(
    path.join(root, 'src/example.ts'),
    "const translated = t('feature.used')\n",
    'utf-8'
  )
  writeJson(path.join(localesDir, 'en.json'), {
    feature: { used: 'Used', unused: 'Unused' },
  })
  writeJson(path.join(localesDir, 'es.json'), locale)

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(scriptsDir, 'check-i18n.ts'), '--release', '--remove-unused'],
    { cwd: PROJECT_ROOT, encoding: 'utf-8' }
  )

  return { root, result }
}

void test('release fix validates locales against the pruned English source', () => {
  const { root, result } = runReleaseFix({ feature: { used: 'Usado' } })

  try {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf-8')),
      { feature: { used: 'Used' } }
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

void test('release fix removes obsolete keys from non-English locales', () => {
  const { root, result } = runReleaseFix({
    feature: { used: 'Usado', unused: 'Sin usar' },
  })

  try {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/es.json'), 'utf-8')),
      { feature: { used: 'Usado' } }
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
