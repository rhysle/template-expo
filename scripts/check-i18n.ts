#!/usr/bin/env npx tsx
/**
 * i18n audit script
 *
 * Checks:
 * 1. Unused translation keys — keys defined in en.json that are never referenced in src/
 * 2. Key mismatches — non-en locale files that are missing keys or have extra keys compared to en.json
 *
 * Usage:
 *   npx tsx scripts/check-i18n.ts
 *   npx tsx scripts/check-i18n.ts --remove-unused   # auto-remove unused keys from all locale files
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src/i18n/locales')
const SRC_DIR = path.join(ROOT, 'src')
const BASE_LOCALE = 'en'

// Keys accessed indirectly, or intentionally provided for future product use.
const IGNORED_UNUSED_KEY_PREFIXES = ['common.', 'currencies.']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NestedRecord = { [key: string]: string | NestedRecord }

/** Flatten a nested object into dot-notation keys: { a: { b: 'x' } } → ['a.b'] */
function flatKeys(obj: NestedRecord, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null ? flatKeys(v as NestedRecord, full) : [full]
  })
}

/**
 * Build a map of dot-notation key → line number in the raw JSON file.
 * Walks the lines looking for quoted key names, tracking nesting depth.
 */
function buildKeyLineMap(filePath: string): Map<string, number> {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  const map = new Map<string, number>()
  const keyStack: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Closing brace — pop the key stack
    if (/^\s*\},?\s*$/.test(line)) {
      keyStack.pop()
      continue
    }

    // Key line — matches "key": { (object) or "key": "value"
    const match = line.match(/^\s*"([^"]+)"\s*:/)
    if (!match) continue

    const key = match[1]
    // Only treat as nested object if the line ends with `{` (not a string value containing `{`)
    const isObject = /:\s*\{\s*$/.test(line)

    const fullKey = [...keyStack, key].join('.')

    if (isObject) {
      keyStack.push(key)
    } else {
      map.set(fullKey, lineNum)
    }
  }

  return map
}

function loadJson(filePath: string): NestedRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as NestedRecord
}

/**
 * Collect dot-notation paths of object nodes that have no leaf descendants.
 * e.g. { common: { error: {} } } → ['common.error']
 * If a parent object contains only empty sub-objects, the parent path is returned instead.
 */
function flatEmptyObjects(obj: NestedRecord, prefix = ''): string[] {
  const result: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) {
      const leaves = flatKeys(v as NestedRecord, full)
      if (leaves.length === 0) {
        // No leaf descendants anywhere in this subtree — the whole thing is empty
        result.push(full)
      } else {
        // Non-empty parent: recurse to find empty sub-objects within it
        result.push(...flatEmptyObjects(v as NestedRecord, full))
      }
    }
  }
  return result
}

/**
 * Recursively remove unused leaf keys from a locale JSON object.
 * If all children of an object node are removed, the object itself is dropped.
 * Pre-existing empty objects ({}) are also dropped automatically.
 */
function pruneUnusedKeys(
  obj: NestedRecord,
  unusedLeafKeys: Set<string>,
  prefix = ''
): NestedRecord {
  const result: NestedRecord = {}
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) {
      const pruned = pruneUnusedKeys(v as NestedRecord, unusedLeafKeys, full)
      if (Object.keys(pruned).length > 0) {
        result[k] = pruned
      }
      // else: entire subtree was unused — drop the key
    } else {
      if (!unusedLeafKeys.has(full)) {
        result[k] = v
      }
      // else: unused leaf — drop it
    }
  }
  return result
}

function getLocaleFiles(): { locale: string; filePath: string }[] {
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ locale: path.basename(f, '.json'), filePath: path.join(LOCALES_DIR, f) }))
}

// ---------------------------------------------------------------------------
// 1. Unused keys
// ---------------------------------------------------------------------------

/**
 * Search src/ for all t('...') / t("...") calls and collect the key strings.
 * Also handles useTranslation namespace variants like t('ns:key').
 * Uses grep for speed.
 */
function collectUsedKeys(): Set<string> {
  const used = new Set<string>()

  // Match t('key') or t("key") — captures the first argument string
  // Also handles i18nKey="..." and Trans i18nKey props
  const patterns = [
    // t('some.key') or t("some.key") with optional options arg
    /\bt\(\s*['"`]([^'"`]+)['"`]/g,
    // i18nKey="some.key" or i18nKey={'some.key'}
    /i18nKey=\{?['"`]([^'"`]+)['"`]/g,
  ]

  let grepOutput = ''
  try {
    // Use grep to quickly find candidate lines across all ts/tsx files
    grepOutput = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" -E "(\\bt\\(|i18nKey)" "${SRC_DIR}"`,
      { encoding: 'utf-8' }
    )
  } catch {
    // grep exits with code 1 when no matches — that's fine
  }

  for (const line of grepOutput.split('\n')) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        // Strip namespace prefix (e.g. "ns:key" → "key")
        const key = match[1].includes(':') ? match[1].split(':').slice(1).join(':') : match[1]
        used.add(key)
      }
    }
  }

  return used
}

// ---------------------------------------------------------------------------
// 2. Key mismatch between locales
// ---------------------------------------------------------------------------

function checkMismatches(
  baseKeys: string[],
  locale: string,
  localeKeys: string[]
): { missing: string[]; extra: string[] } {
  const baseSet = new Set(baseKeys)
  const localeSet = new Set(localeKeys)

  const missing = baseKeys.filter((k) => !localeSet.has(k))
  const extra = localeKeys.filter((k) => !baseSet.has(k))

  return { missing, extra }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const removeUnused = process.argv.includes('--remove-unused')

  const localeFiles = getLocaleFiles()
  const baseFile = localeFiles.find((f) => f.locale === BASE_LOCALE)

  if (!baseFile) {
    console.error(`❌ Base locale file "${BASE_LOCALE}.json" not found in ${LOCALES_DIR}`)
    process.exit(1)
  }

  const baseJson = loadJson(baseFile.filePath)
  const baseKeys = flatKeys(baseJson)
  const baseLineMap = buildKeyLineMap(baseFile.filePath)

  let hasErrors = false

  // ── 1. Unused keys ──────────────────────────────────────────────────────
  console.log('\n🔍 Checking for unused translation keys...\n')

  const usedKeys = collectUsedKeys()
  const unusedKeys = baseKeys.filter(
    (k) =>
      !usedKeys.has(k) && !IGNORED_UNUSED_KEY_PREFIXES.some((prefix) => k.startsWith(prefix))
  )
  const emptyObjectKeys = flatEmptyObjects(baseJson)

  const totalProblems = unusedKeys.length + emptyObjectKeys.length

  if (totalProblems === 0) {
    console.log('  ✅ All translation keys are used.')
  } else if (removeUnused) {
    const unusedSet = new Set(unusedKeys)
    for (const { filePath } of localeFiles) {
      const json = loadJson(filePath)
      const pruned = pruneUnusedKeys(json, unusedSet)
      fs.writeFileSync(filePath, JSON.stringify(pruned, null, 2) + '\n', 'utf-8')
    }
    if (unusedKeys.length > 0) {
      console.log(`  🗑️  Removed ${unusedKeys.length} unused key(s) from all locale files:\n`)
      unusedKeys.forEach((k) => console.log(`     - ${k}`))
    }
    if (emptyObjectKeys.length > 0) {
      console.log(
        `  🗑️  Removed ${emptyObjectKeys.length} empty object(s) from all locale files:\n`
      )
      emptyObjectKeys.forEach((k) => console.log(`     - ${k}`))
    }
  } else {
    hasErrors = true
    if (unusedKeys.length > 0) {
      console.log(`  ⚠️  ${unusedKeys.length} unused key(s) found in ${BASE_LOCALE}.json:\n`)
      unusedKeys.forEach((k) => {
        const line = baseLineMap.get(k) ?? 1
        console.log(`     - ${k}  ${baseFile.filePath}:${line}:1`)
      })
    }
    if (emptyObjectKeys.length > 0) {
      console.log(`  ⚠️  ${emptyObjectKeys.length} empty object(s) found in ${BASE_LOCALE}.json:\n`)
      emptyObjectKeys.forEach((k) => console.log(`     - ${k}  (empty — no translation values)`))
    }
    console.log(`\n  💡 Run with --remove-unused to automatically delete them.`)
  }

  // ── 2. Key mismatches ───────────────────────────────────────────────────
  console.log('\n🔍 Checking locale key mismatches...\n')

  const nonBaseLocales = localeFiles.filter((f) => f.locale !== BASE_LOCALE)

  if (nonBaseLocales.length === 0) {
    console.log('  ℹ️  No non-base locale files found to compare.')
  }

  for (const { locale, filePath } of nonBaseLocales) {
    const localeJson = loadJson(filePath)
    const localeKeys = flatKeys(localeJson)
    const localeLineMap = buildKeyLineMap(filePath)
    const { missing, extra } = checkMismatches(baseKeys, locale, localeKeys)

    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ✅ ${locale}.json — keys match ${BASE_LOCALE}.json perfectly.`)
    } else {
      hasErrors = true
      console.log(`  ❌ ${locale}.json has mismatches:`)

      if (missing.length > 0) {
        console.log(`\n     Missing keys (in ${BASE_LOCALE} but not in ${locale}):`)
        missing.forEach((k) => {
          // Point to where the key lives in en.json (so you know what to add)
          const line = baseLineMap.get(k) ?? 1
          console.log(`       - ${k}  ${baseFile.filePath}:${line}:1`)
        })
      }

      if (extra.length > 0) {
        console.log(`\n     Extra keys (in ${locale} but not in ${BASE_LOCALE}):`)
        extra.forEach((k) => {
          // Point to the rogue key in the locale file itself
          const line = localeLineMap.get(k) ?? 1
          console.log(`       + ${k}  ${filePath}:${line}:1`)
        })
      }

      console.log()
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log()
  if (hasErrors) {
    console.log('❌ i18n audit failed. Fix the issues above.')
    process.exit(1)
  } else {
    console.log('✅ i18n audit passed.')
  }
}

main()
