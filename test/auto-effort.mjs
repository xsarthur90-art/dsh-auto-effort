// Offline checks: config validation and the two judge calls. No network, no host.
import assert from 'node:assert/strict'
import { resolveConfig } from '../config.js'
import { judgeLevel, summarizeCard, CARD_MAX_CHARS } from '../judge.js'

const defaults = resolveConfig(undefined)
assert.equal(defaults.mode, 'auto')
assert.equal(defaults.enabled, true)
assert.equal(defaults.judgeModel, 'deepseek-flash')
assert.equal(defaults.timeoutMs, 3000)
assert.equal(defaults.cardInputChars, 600)
assert.equal(defaults.cardMaxChars, 120)
assert.equal(defaults.requireMaxForUpgrade, false)
assert.deepEqual(defaults.levels, ['off', 'low', 'high', 'max'])

assert.throws(() => resolveConfig({ levels: ['xhigh'] }), /levels/)
assert.throws(() => resolveConfig({ defaultLevel: 'medium' }), /defaultLevel/)
assert.throws(() => resolveConfig({ mode: 'sometimes' }), /mode/)
assert.throws(() => resolveConfig({ timeoutMs: 0 }), /timeoutMs/)
assert.throws(() => resolveConfig({ timeoutMs: 1.5 }), /timeoutMs/)
assert.throws(() => resolveConfig({ cardMaxChars: -3 }), /cardMaxChars/)
assert.throws(() => resolveConfig({ judgeModel: 5 }), /judgeModel/)
// Blank and "model" both mean "judge with this conversation's own model".
assert.equal(resolveConfig({ judgeModel: '  ' }).judgeModel, '  ')
assert.equal(resolveConfig({ judgeModel: 'model' }).judgeModel, 'model')
assert.deepEqual(resolveConfig({ levels: ['off', 'high', 'high'] }).levels, ['off', 'high'])

// The config may arrive as a volatile reference instead of a plain value.
assert.equal(resolveConfig({ mode: { get: () => 'manual' } }).mode, 'manual')

/** A stand-in for the host `llm` service that answers with a fixed string. */
function fakeLlm(answer, { delayMs = 0, usage = null, chunks = null, finishKind = 'stop', failFirst = null } = {}) {
  const calls = []
  return {
    calls,
    async prepareCall(config) {
      calls.push(config)
      if (failFirst !== null && calls.length === 1) throw new Error(failFirst)
      return {
        config,
        async *stream() {
          if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs))
          for (const piece of chunks ?? [answer]) {
            yield { type: 'text-delta', text: piece }
          }
          if (usage !== null) yield { type: 'usage', usage }
          yield { type: 'finish', reason: { kind: finishKind } }
        },
      }
    },
  }
}

const judge = (answer, options) =>
  judgeLevel({ llm: fakeLlm(answer, options), provider: 'deepseek', model: 'deepseek-flash', text: '好的', timeoutMs: 500 })

assert.equal(await judge('off'), 'off')
assert.equal(await judge('  HIGH\n'), 'high')
assert.equal(await judge('等级：max。'), 'max')
assert.equal(await judge('low'), 'low')
// A stream that arrives in pieces still forms one word.
assert.equal(await judge('', { chunks: ['ma', 'x'] }), 'max')
await assert.rejects(() => judge('我也不知道'), /no level/)

// A truncated answer is only trusted when it is one clean word: "hi" cut short
// would otherwise be read as nothing at all, or worse, as a wrong level.
await assert.rejects(() => judge('hi', { finishKind: 'max-tokens' }), /no level/)
assert.equal(await judge('high', { finishKind: 'max-tokens' }), 'high')

// One transient failure is retried instead of counting against the breaker.
const flaky = fakeLlm('high', { failFirst: 'fetch failed' })
assert.equal(
  await judgeLevel({ llm: flaky, provider: 'deepseek', model: 'deepseek-flash', text: 'x', timeoutMs: 500 }),
  'high',
)
assert.equal(flaky.calls.length, 2)

// A hard failure (bad request) is not retried.
const hard = fakeLlm('high', { failFirst: 'invalid request' })
await assert.rejects(() =>
  judgeLevel({ llm: hard, provider: 'deepseek', model: 'deepseek-flash', text: 'x', timeoutMs: 500 }), /invalid request/,
)
assert.equal(hard.calls.length, 1)

const timedOut = await judgeLevel({
  llm: fakeLlm('high', { delayMs: 200 }),
  provider: 'deepseek',
  model: 'deepseek-flash',
  text: 'x',
  timeoutMs: 20,
}).catch(error => error)
assert.match(String(timedOut.message), /timed out/)

// The blocking call must be tiny: one word, and the effort is off.
const small = fakeLlm('low')
await judgeLevel({ llm: small, provider: 'deepseek', model: 'deepseek-flash', text: 'x', timeoutMs: 500 })
assert.equal(small.calls[0].maxTokens, 8)
assert.equal(small.calls[0].reasoningEffort, 'off')

// Usage arrives through the callback, which is how the cost counter sees it.
const seen = []
await judgeLevel({
  llm: fakeLlm('high', { usage: { inputTokens: 10, outputTokens: 2 } }),
  provider: 'deepseek',
  model: 'deepseek-flash',
  text: 'x',
  timeoutMs: 500,
  onUsage: usage => seen.push(usage),
})
assert.deepEqual(seen, [{ inputTokens: 10, outputTokens: 2 }])

// The card is trimmed, flattened and capped.
const card = fakeLlm('改 README，还剩 3 节。')
const written = await summarizeCard({
  llm: card,
  provider: 'deepseek',
  model: 'deepseek-flash',
  card: '',
  text: '把 README 剩下三节补完',
  assistant: '好的，我先补第二节。',
  timeoutMs: 500,
})
assert.equal(written, '改 README，还剩 3 节。')
assert.equal(card.calls[0].maxTokens, 320)

const long = fakeLlm('长'.repeat(400))
const capped = await summarizeCard({
  llm: long,
  provider: 'deepseek',
  model: 'deepseek-flash',
  text: 'x',
  timeoutMs: 500,
})
assert.equal(capped.length, CARD_MAX_CHARS)

const prefixed = await summarizeCard({
  llm: fakeLlm('card: 只有一个目标'),
  provider: 'deepseek',
  model: 'deepseek-flash',
  text: 'x',
  timeoutMs: 500,
})
assert.equal(prefixed, '只有一个目标')

console.log('auto-effort offline checks: OK')
