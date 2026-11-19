/**
 * Plugin configuration. This bundle ships without dependencies (a linked local
 * bundle cannot resolve the profile's node_modules), so the schema is validated
 * by hand and every error names the offending key instead of silently coercing
 * it.
 */

export const LEVELS = Object.freeze(['off', 'low', 'high', 'max'])

/** Config. The judge and the card are the only parts that cost money. */
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  // The default for a NEW conversation. The menu row switches one conversation
  // and lives in the per-agent state, so it is not this field.
  mode: 'auto',
  levels: LEVELS,
  // Which model answers the judge call: "model" keeps the conversation's own
  // provider, "model" or "provider/model" names another one.
  judgeModel: 'deepseek-flash',
  // How long the blocking judge call may take before the turn runs at the level
  // you had picked by hand.
  timeoutMs: 3000,
  // How much of the assistant reply the card writer reads, and how long the card
  // itself may be. Both are direct cost knobs.
  cardInputChars: 600,
  cardMaxChars: 120,
  defaultLevel: null,
  requireMaxForUpgrade: false,
  // One line per judged turn in `~/.dsh/auto-effort.log` when enabled.
  debug: false,
  logFile: null,
})

function fail(message) {
  throw new Error(`[auto-effort] invalid config: ${message}`)
}

/**
 * Read one config field, unwrapping a volatile reference.
 * A field declared `.volatile()` in `schema.js` reaches the plugin as a live
 * reference (read with `.get()`), not as a plain value.
 */
export function field(input, key) {
  const value = input?.[key]
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') return value.get()
  return value
}

function positiveInteger(value, key, fallback) {
  if (value === undefined || value === null) return fallback
  if (!Number.isInteger(value) || value <= 0) fail(`${key} must be a positive integer`)
  return value
}

/**
 * Merge defaults with the patch/profiles config and validate every field.
 * @param {unknown} raw - value handed to `apply` by the Cordis loader.
 * @returns {Readonly<typeof DEFAULT_CONFIG>} validated config.
 */
export function resolveConfig(raw) {
  const input = raw === undefined || raw === null ? {} : raw
  if (typeof input !== 'object' || Array.isArray(input)) fail('expected an object')

  const enabled = field(input, 'enabled') ?? DEFAULT_CONFIG.enabled
  if (typeof enabled !== 'boolean') fail('enabled must be a boolean')

  const mode = field(input, 'mode') ?? DEFAULT_CONFIG.mode
  if (mode !== 'manual' && mode !== 'auto') fail('mode must be "manual" or "auto"')

  const levelsInput = field(input, 'levels') ?? DEFAULT_CONFIG.levels
  if (!Array.isArray(levelsInput) || levelsInput.length === 0) fail('levels must be a non-empty array')
  const levels = []
  for (const level of levelsInput) {
    if (!LEVELS.includes(level)) fail(`levels contains "${String(level)}"; allowed: ${LEVELS.join(', ')}`)
    if (!levels.includes(level)) levels.push(level)
  }

  // Empty or "model" both mean: judge with whatever model this conversation is
  // already using, so the judge always sees the same route the user picked.
  const judgeModel = field(input, 'judgeModel') ?? DEFAULT_CONFIG.judgeModel
  if (typeof judgeModel !== 'string') fail('judgeModel must be a string')

  const timeoutMs = positiveInteger(field(input, 'timeoutMs'), 'timeoutMs', DEFAULT_CONFIG.timeoutMs)
  const cardInputChars = positiveInteger(field(input, 'cardInputChars'), 'cardInputChars', DEFAULT_CONFIG.cardInputChars)
  const cardMaxChars = positiveInteger(field(input, 'cardMaxChars'), 'cardMaxChars', DEFAULT_CONFIG.cardMaxChars)

  const defaultLevel = field(input, 'defaultLevel') ?? DEFAULT_CONFIG.defaultLevel
  if (defaultLevel !== null && !LEVELS.includes(defaultLevel)) {
    fail(`defaultLevel must be null or one of ${LEVELS.join(', ')}`)
  }

  const requireMaxForUpgrade = field(input, 'requireMaxForUpgrade') ?? DEFAULT_CONFIG.requireMaxForUpgrade
  if (typeof requireMaxForUpgrade !== 'boolean') fail('requireMaxForUpgrade must be a boolean')

  const debug = field(input, 'debug') ?? DEFAULT_CONFIG.debug
  if (typeof debug !== 'boolean') fail('debug must be a boolean')

  const logFile = field(input, 'logFile') ?? DEFAULT_CONFIG.logFile
  if (logFile !== null && typeof logFile !== 'string') fail('logFile must be null or a path string')

  return Object.freeze({
    enabled,
    mode,
    levels: Object.freeze(levels),
    judgeModel,
    timeoutMs,
    cardInputChars,
    cardMaxChars,
    defaultLevel,
    requireMaxForUpgrade,
    debug,
    logFile,
  })
}
