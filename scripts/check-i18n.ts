#!/usr/bin/env npx tsx
/**
 * i18n audit script
 *
 * Checks:
 * 1. Unused English translation keys — keys defined in en.json that are never referenced in src/
 * 2. Empty English translation objects or values
 *
 * Non-English locales are intentionally ignored during product development. They are translated
 * and reviewed together as a separate release-preparation task.
 *
 * Usage:
 *   npx tsx scripts/check-i18n.ts
 *   npx tsx scripts/check-i18n.ts --remove-unused   # auto-remove unused keys from en.json
 *   npx tsx scripts/check-i18n.ts --release         # validate every locale before release
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

/** Flatten a nested object into a dot-notation key → value map. */
function flatValues(
  obj: NestedRecord,
  prefix = '',
  result = new Map<string, string>()
): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) {
      flatValues(v as NestedRecord, full, result)
    } else if (typeof v === 'string') {
      result.set(full, v)
    }
  }
  return result
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

/** Collect dot-notation paths of blank English translation values. */
function flatEmptyValues(obj: NestedRecord, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) {
      return flatEmptyValues(v as NestedRecord, full)
    }
    return typeof v !== 'string' || v.trim().length === 0 ? [full] : []
  })
}

/**
 * Recursively remove unused leaf keys from the English JSON object.
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
// Release locale checks
// ---------------------------------------------------------------------------

function getNonBaseLocaleFiles(): { locale: string; filePath: string }[] {
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((fileName) => fileName.endsWith('.json') && fileName !== `${BASE_LOCALE}.json`)
    .sort()
    .map((fileName) => ({
      locale: path.basename(fileName, '.json'),
      filePath: path.join(LOCALES_DIR, fileName),
    }))
}

function extractPlaceholders(value: string): string[] {
  return value.match(/{{[^{}]+}}/g)?.sort() ?? []
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function checkReleaseLocales(baseKeys: string[], baseValues: Map<string, string>): boolean {
  console.log('\n🔍 Checking every release locale...\n')

  const baseKeySet = new Set(baseKeys)
  const localeFiles = getNonBaseLocaleFiles()
  let hasErrors = false

  if (localeFiles.length === 0) {
    console.log('  ℹ️  No non-English locale files are configured.')
    return false
  }

  for (const { locale, filePath } of localeFiles) {
    const localeJson = loadJson(filePath)
    const localeKeys = flatKeys(localeJson)
    const localeKeySet = new Set(localeKeys)
    const localeValues = flatValues(localeJson)
    const localeLineMap = buildKeyLineMap(filePath)
    const missingKeys = baseKeys.filter((key) => !localeKeySet.has(key))
    const extraKeys = localeKeys.filter((key) => !baseKeySet.has(key))
    const emptyObjectKeys = flatEmptyObjects(localeJson)
    const emptyValueKeys = flatEmptyValues(localeJson)
    const placeholderMismatchKeys = baseKeys.filter((key) => {
      const baseValue = baseValues.get(key)
      const localeValue = localeValues.get(key)
      if (baseValue === undefined || localeValue === undefined) return false
      return !sameStrings(extractPlaceholders(baseValue), extractPlaceholders(localeValue))
    })

    const localeProblemCount =
      missingKeys.length +
      extraKeys.length +
      emptyObjectKeys.length +
      emptyValueKeys.length +
      placeholderMismatchKeys.length

    if (localeProblemCount === 0) {
      console.log(`  ✅ ${locale}.json — complete with matching placeholders.`)
      continue
    }

    hasErrors = true
    console.log(`  ❌ ${locale}.json has release blockers:`)

    if (missingKeys.length > 0) {
      console.log('\n     Missing keys:')
      missingKeys.forEach((key) => console.log(`       - ${key}`))
    }
    if (extraKeys.length > 0) {
      console.log('\n     Extra keys:')
      extraKeys.forEach((key) => {
        const line = localeLineMap.get(key) ?? 1
        console.log(`       - ${key}  ${filePath}:${line}:1`)
      })
    }
    if (emptyObjectKeys.length > 0) {
      console.log('\n     Empty objects:')
      emptyObjectKeys.forEach((key) => console.log(`       - ${key}`))
    }
    if (emptyValueKeys.length > 0) {
      console.log('\n     Empty values:')
      emptyValueKeys.forEach((key) => {
        const line = localeLineMap.get(key) ?? 1
        console.log(`       - ${key}  ${filePath}:${line}:1`)
      })
    }
    if (placeholderMismatchKeys.length > 0) {
      console.log('\n     Interpolation placeholder mismatches:')
      placeholderMismatchKeys.forEach((key) => {
        const line = localeLineMap.get(key) ?? 1
        console.log(`       - ${key}  ${filePath}:${line}:1`)
      })
    }

    console.log()
  }

  return hasErrors
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const removeUnused = process.argv.includes('--remove-unused')
  const release = process.argv.includes('--release')

  const baseFilePath = path.join(LOCALES_DIR, `${BASE_LOCALE}.json`)

  if (!fs.existsSync(baseFilePath)) {
    console.error(`❌ Base locale file "${BASE_LOCALE}.json" not found in ${LOCALES_DIR}`)
    process.exit(1)
  }

  const baseJson = loadJson(baseFilePath)
  const baseKeys = flatKeys(baseJson)
  const baseLineMap = buildKeyLineMap(baseFilePath)

  let hasErrors = false

  console.log('\n🔍 Checking the English source locale...\n')

  const usedKeys = collectUsedKeys()
  const unusedKeys = baseKeys.filter(
    (k) => !usedKeys.has(k) && !IGNORED_UNUSED_KEY_PREFIXES.some((prefix) => k.startsWith(prefix))
  )
  const emptyObjectKeys = flatEmptyObjects(baseJson)
  const emptyValueKeys = flatEmptyValues(baseJson)

  const totalProblems = unusedKeys.length + emptyObjectKeys.length + emptyValueKeys.length

  if (totalProblems === 0) {
    console.log('  ✅ All English translation keys are used and have values.')
  } else if (removeUnused) {
    const unusedSet = new Set(unusedKeys)
    const pruned = pruneUnusedKeys(baseJson, unusedSet)
    fs.writeFileSync(baseFilePath, JSON.stringify(pruned, null, 2) + '\n', 'utf-8')

    if (unusedKeys.length > 0) {
      console.log(`  🗑️  Removed ${unusedKeys.length} unused key(s) from ${BASE_LOCALE}.json:\n`)
      unusedKeys.forEach((k) => console.log(`     - ${k}`))
    }
    if (emptyObjectKeys.length > 0) {
      console.log(
        `  🗑️  Removed ${emptyObjectKeys.length} empty object(s) from ${BASE_LOCALE}.json:\n`
      )
      emptyObjectKeys.forEach((k) => console.log(`     - ${k}`))
    }
    if (emptyValueKeys.length > 0) {
      hasErrors = true
      console.log(`  ⚠️  ${emptyValueKeys.length} empty value(s) require English copy:\n`)
      emptyValueKeys.forEach((k) => {
        const line = baseLineMap.get(k) ?? 1
        console.log(`     - ${k}  ${baseFilePath}:${line}:1`)
      })
    }
  } else {
    hasErrors = true
    if (unusedKeys.length > 0) {
      console.log(`  ⚠️  ${unusedKeys.length} unused key(s) found in ${BASE_LOCALE}.json:\n`)
      unusedKeys.forEach((k) => {
        const line = baseLineMap.get(k) ?? 1
        console.log(`     - ${k}  ${baseFilePath}:${line}:1`)
      })
    }
    if (emptyObjectKeys.length > 0) {
      console.log(`  ⚠️  ${emptyObjectKeys.length} empty object(s) found in ${BASE_LOCALE}.json:\n`)
      emptyObjectKeys.forEach((k) => console.log(`     - ${k}  (empty — no translation values)`))
    }
    if (emptyValueKeys.length > 0) {
      console.log(`  ⚠️  ${emptyValueKeys.length} empty value(s) found in ${BASE_LOCALE}.json:\n`)
      emptyValueKeys.forEach((k) => {
        const line = baseLineMap.get(k) ?? 1
        console.log(`     - ${k}  ${baseFilePath}:${line}:1`)
      })
    }
    if (unusedKeys.length > 0 || emptyObjectKeys.length > 0) {
      console.log(`\n  💡 Run with --remove-unused to delete unused keys and empty objects.`)
    }
    if (emptyValueKeys.length > 0) {
      console.log(`\n  💡 Add English copy for every empty value.`)
    }
  }

  if (release && checkReleaseLocales(baseKeys, flatValues(baseJson))) {
    hasErrors = true
  }

  console.log()
  if (hasErrors) {
    console.log(`❌ ${release ? 'Release' : 'English'} i18n audit failed. Fix the issues above.`)
    process.exit(1)
  } else {
    console.log(
      release
        ? '✅ Release i18n audit passed.'
        : '✅ English i18n audit passed. Non-English locales were not checked.'
    )
  }
}

main()
