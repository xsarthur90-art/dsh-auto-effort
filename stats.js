/**
 * Per-conversation accounting for the judge calls.
 *
 * The numbers shown in the model menu and on the plugin page come from here.
 * Nothing is written to the profile or to the session log: the rows live in
 * memory for the life of the plugin, which is exactly what "this conversation
 * has cost so much so far" needs. Restarting DSH clears them.
 *
 * Prices are DeepSeek's published CNY list for `deepseek-flash` (2026-11), per
 * million tokens: input cache-miss ¥2 peak / ¥1 off-peak, input cache-hit
 * ¥0.04 / ¥0.02, output ¥8 / ¥4. Peak runs Mon–Fri 09:00–12:00 and
 * 14:00–18:00 Beijing time; Chinese public holidays are NOT modelled here, so a
 * holiday hour is priced as peak (the difference is half a fen per message).
 */

export const PRICES_CNY_PER_M = {
  peak: { miss: 2, hit: 0.04, out: 8 },
  offPeak: { miss: 1, hit: 0.02, out: 4 },
}

/** The same list prices as DeepSeek publishes them in USD. */
export const PRICES_USD_PER_M = {
  peak: { miss: 0.3, hit: 0.006, out: 1.2 },
  offPeak: { miss: 0.15, hit: 0.003, out: 0.6 },
}

const BEIJING = 'Asia/Shanghai'

/**
 * Built once: `Intl.DateTimeFormat` costs far more to construct than to use, and
 * this runs for every recorded call and every `/stats` request.
 */
const beijingClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BEIJING,
  weekday: 'short',
  hour: '2-digit',
  hour12: false,
})

/** @returns {{ weekday: number, hour: number }} in Beijing time. */
function beijing(now) {
  const parts = beijingClock.formatToParts(now)
  const weekdayName = parts.find(part => part.type === 'weekday')?.value ?? 'Mon'
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0')
  const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return { weekday: Math.max(0, order.indexOf(weekdayName)), hour }
}

/** Whether `now` falls in a peak-price window. */
export function isPeak(now = new Date()) {
  const { weekday, hour } = beijing(now)
  if (weekday !== 0 && weekday !== 6) {
    if (hour >= 9 && hour < 12) return true
    if (hour >= 14 && hour < 18) return true
  }
  return false
}

/**
 * Cost of one model call in CNY.
 * `TokenUsage` counts are disjoint: inputTokens is uncached input, cached input
 * is reported separately, billed input is the sum of the three.
 */
function price(usage, table) {
  if (usage === null || typeof usage !== 'object') return 0
  const num = value => (Number.isFinite(value) && value > 0 ? value : 0)
  const miss = num(usage.inputTokens) + num(usage.cacheWriteTokens)
  const hit = num(usage.cacheReadTokens)
  const out = num(usage.outputTokens)
  return (miss * table.miss + hit * table.hit + out * table.out) / 1e6
}

export function costCny(usage, peak = isPeak()) {
  return price(usage, peak ? PRICES_CNY_PER_M.peak : PRICES_CNY_PER_M.offPeak)
}

/** Official USD list price, never a conversion of the CNY figure. */
export function costUsd(usage, peak = isPeak()) {
  return price(usage, peak ? PRICES_USD_PER_M.peak : PRICES_USD_PER_M.offPeak)
}

const bySession = new Map()
const total = { count: 0, ms: 0, cny: 0, usd: 0, inTokens: 0, outTokens: 0 }

function bucket(sessionId) {
  let row = bySession.get(sessionId)
  if (row === undefined) {
    row = { count: 0, ms: 0, cny: 0, usd: 0, inTokens: 0, outTokens: 0 }
    bySession.set(sessionId, row)
  }
  return row
}

/**
 * Add one finished call.
 * @param {object} entry
 * @param {string} entry.sessionId
 * @param {'judge'|'card'} entry.kind - only `judge` counts as a trigger and as
 *   wait time, because only it makes the user wait; its cost is still counted.
 * @param {number} entry.ms
 * @param {object} [entry.usage]
 */
export function record({ sessionId, kind, ms, usage }) {
  const peak = isPeak()
  const cny = costCny(usage, peak)
  const usd = costUsd(usage, peak)
  const row = bucket(sessionId)
  row.cny += cny
  row.usd += usd
  row.inTokens += Number(usage?.inputTokens) || 0
  row.outTokens += Number(usage?.outputTokens) || 0
  total.cny += cny
  total.usd += usd
  total.inTokens += Number(usage?.inputTokens) || 0
  total.outTokens += Number(usage?.outputTokens) || 0
  if (kind === 'judge') {
    row.count += 1
    row.ms += Math.max(0, Number(ms) || 0)
    total.count += 1
    total.ms += Math.max(0, Number(ms) || 0)
  }
}

/** One conversation's numbers. */
/** Last known plugin state per conversation, so the UI can say why it stopped. */
const statuses = new Map()

/** Remember what the plugin is doing for one conversation. */
export function setStatus(sessionId, status) {
  if (sessionId === null || sessionId === undefined) return
  statuses.set(String(sessionId), { ...status })
}

/** The remembered state, or undefined when the conversation was never judged. */
export function sessionStatus(sessionId) {
  return statuses.get(String(sessionId))
}

export function sessionStats(sessionId) {
  const row = bySession.get(sessionId)
  if (row === undefined) return { count: 0, ms: 0, cny: 0, usd: 0 }
  return { count: row.count, ms: row.ms, cny: row.cny, usd: row.usd }
}

/** Everything since the plugin loaded. */
export function totalStats() {
  return { ...total, conversations: bySession.size }
}

/**
 * Drop one conversation's rows when the conversation is gone for good.
 * The running total is NOT reduced: it means "since the plugin loaded", and the
 * plugin page keeps showing it after individual conversations are closed.
 */
export function forget(sessionId) {
  const key = String(sessionId)
  bySession.delete(key)
  statuses.delete(key)
}
