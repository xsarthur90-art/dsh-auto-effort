/**
 * The judge works in two independent, lightweight LLM calls per turn.
 *
 * 1. `judgeLevel` — the blocking call. Input is the task card (what the
 *    conversation is working on) plus the newest user message; output is one
 *    word. It runs before the message is queued, so its latency is felt by the
 *    user, which is why it stays as short as the brief §2.1 requires.
 * 2. `summarizeCard` — the background call. It runs after the turn has started
 *    (fire-and-forget from `agent/turn-stopping`) and rewrites the task card from
 *    the user message and the assistant reply. It never blocks a turn.
 *
 * The task card is the only cross-turn context the judge sees: no transcript, no
 * tool output, no file contents.
 */
import { randomUUID } from 'node:crypto'

/** Longest task card we keep, in characters. */
export const CARD_MAX_CHARS = 120

/** Longest assistant reply excerpt the card writer reads. */
export const CARD_INPUT_CHARS = 600
/** Cap on the user message we echo into either call. A pasted log or file can
 * be tens of thousands of characters; the leader of the message is what tells us
 * how hard the work is, and the rest only costs tokens. */
export const TEXT_MAX_CHARS = 2000

/** Stable prefix for the blocking call: never interpolate per-turn text here. */
export const LEVEL_SYSTEM = [
  '你是任务难度判断器。输入是任务便签（可能为空）和用户的新消息。',
  '只判断“回答这条消息需要多强的推理”，不要回答它。',
  '只输出一个词：off、low、high、max，不要解释、不要标点、不要换行。',
].join('\n')

/** The four-way rubric from the brief §2.3, plus the card rules. */
export const LEVEL_INSTRUCTION = [
  '推理等级标准：',
  'off：闲聊、确认、查资料、改配置、跑命令。',
  'low：小改动、改名、整理；做法已经明确，照着改就行（改语法、改写法、统一命名）。',
  'high：需要自己拿主意——分析原因、排查报错、解释原理、写较复杂代码、做设计取舍。',
  'max：架构方案、多方案比较、多因素权衡、疑难 bug 的根因、长链条推理。',
  '',
  '便签是这轮对话在做的事：',
  '用户只回“开始”“好的”“继续”，就按便签里没做完的事判，别因为它短就判 off。',
  '消息和便签无关（换了话题），就当便签是空的。',
  '能独立回答的小问题就是新话题：问时间、日期、天气、几点这类一句话就能答的事，即使带了“顺便”“对了”，也判 off，不要因为便签里正忙别的就判高。',
].join('\n')

/** Stable prefix for the background card call. */
export const CARD_SYSTEM = [
  '你维护一张给“难度判断”用的任务便签。',
  '输入是旧便签、用户的新消息、助手对这条消息的回复。',
  '只输出便签正文，不要标题、不要解释、不要换行。',
].join('\n')

export function cardInstruction(maxChars = CARD_MAX_CHARS) {
  return [
    `不超过 ${maxChars} 字，写清：目标、对象、做到哪一步、还差什么。`,
    '新任务重写，同一件事的追加要求合并进去。',
    '不抄用户原话，不记寒暄和已完成的事，不写文件内容。',
    '这一轮只是闲聊或确认，就原样输出旧便签。',
  ].join('\n')
}

const WORD_RE = /\b(off|low|high|max)\b/i

/** One clean word and nothing else — the only shape a truncated answer may take. */
const EXACT_WORD_RE = /^(off|low|high|max)[.!。]?$/i

/** Failures worth one more attempt; a timeout is not, since the user is waiting. */
const RETRYABLE = /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|socket hang up|network error|getaddrinfo|\b429\b|rate.?limit|too many requests|overloaded|\b50[0-9]\b|internal server error|bad gateway|service unavailable|upstream error|returned no level|truncated/i

/** Subset of the adapter error that means “this model has no such effort”. */
function isUnsupportedEffort(error) {
  const code = error?.code ?? error?.data?.code
  const text = String(error?.message ?? error ?? '')
  return code === 'UNSUPPORTED_REASONING_EFFORT' || /UNSUPPORTED_REASONING_EFFORT|does not support reasoning effort/i.test(text)
}

function combineSignals(signal, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`judge timed out after ${timeoutMs} ms`)), timeoutMs)
  const forward = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) forward()
    else signal.addEventListener('abort', forward, { once: true })
  }
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', forward)
    },
  }
}

/**
 * One bounded streaming call; returns the collected text.
 * @param {object} options
 */
async function call({ llm, provider, model, system, prompt, maxTokens, timeoutMs, signal, debug, onUsage }) {
  if (typeof llm?.prepareCall !== 'function') throw new Error('the host llm service is unavailable')
  const route = { provider, model }
  const bound = combineSignals(signal, timeoutMs)
  try {
    let prepared
    try {
      prepared = await llm.prepareCall({ ...route, maxTokens, reasoningEffort: 'off' }, bound.signal, controls => controls)
    } catch (error) {
      // A route that cannot run with `off` still answers; drop the effort.
      if (!isUnsupportedEffort(error)) throw error
      prepared = await llm.prepareCall({ ...route, maxTokens }, bound.signal, controls => controls)
    }
    bound.signal.throwIfAborted()
    const options = Object.freeze({
      ...prepared.config,
      messages: [{
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      }],
      system,
      signal: bound.signal,
    })
    let answer = ''
    let finish
    for await (const chunk of prepared.stream(options)) {
      bound.signal.throwIfAborted()
      if (chunk.type === 'text-delta') answer += chunk.text
      else if (chunk.type === 'usage') onUsage?.(chunk.usage)
      else if (chunk.type === 'finish') finish = chunk.reason
    }
    bound.signal.throwIfAborted()
    debug?.(`raw=${JSON.stringify(answer.trim().slice(0, 160))} finish=${JSON.stringify(finish)}`)
    if (finish && finish.kind !== 'stop' && finish.kind !== 'max-tokens') {
      throw new Error(`judge finished with ${finish.kind}`)
    }
    return { text: answer, finish }
  } finally {
    bound.dispose()
  }
}

/**
 * The blocking call: ask for the level of this turn.
 * @param {object} options
 * @param {{ prepareCall: Function }} options.llm
 * @param {string} options.provider
 * @param {string} options.model
 * @param {string} options.text - the newest user message, unchanged.
 * @param {string} [options.card] - the task card produced last turn.
 * @param {number} [options.cardMaxChars] - cap for the card text we echo.
 * @param {number} options.timeoutMs
 * @param {AbortSignal} [options.signal]
 * @param {(message: string) => void} [options.debug]
 * @returns {Promise<string>} one of off|low|high|max.
 */
export async function judgeLevel({ llm, provider, model, text, card, cardMaxChars = CARD_MAX_CHARS, timeoutMs, signal, debug, onUsage }) {
  const known = typeof card === 'string' && card.trim() !== '' ? card.trim().slice(0, cardMaxChars) : null
  const message = typeof text === 'string' ? text.slice(0, TEXT_MAX_CHARS) : ''
  const prompt = `${LEVEL_INSTRUCTION}\n\n任务便签：\n${known ?? '（空，这是本次对话的第一条消息）'}\n\n用户新消息：\n${message}`
  const started = Date.now()
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // The user is waiting, so the whole judge call gets one budget, not one per
    // attempt. A retry only happens while enough of it is left to be worth it.
    const left = timeoutMs - (Date.now() - started)
    if (left < 100) break
    try {
      const { text: answer, finish } = await call({
        llm, provider, model, system: LEVEL_SYSTEM, prompt, maxTokens: 8, timeoutMs: left, signal, debug, onUsage,
      })
      const trimmed = answer.trim()
      // max-tokens means the model kept talking past the word: only a bare word
      // is trustworthy then, a half-written one must never be used as the answer.
      const match = finish?.kind === 'max-tokens' && !EXACT_WORD_RE.test(trimmed) ? null : WORD_RE.exec(answer)
      if (!match) throw new Error(`judge returned no level: ${JSON.stringify(trimmed.slice(0, 40))}`)
      return match[1].toLowerCase()
    } catch (error) {
      lastError = error
      const text = String(error?.message ?? error)
      if (attempt === 1 || !RETRYABLE.test(text)) throw error
      debug?.(`retrying once: ${text}`)
    }
  }
  if (lastError) throw lastError
  throw new Error(`judge timed out after ${timeoutMs} ms`)
}

/**
 * The background call: rewrite the task card after the turn started.
 * @param {object} options
 * @param {{ prepareCall: Function }} options.llm
 * @param {string} options.provider
 * @param {string} options.model
 * @param {string} [options.card]
 * @param {string} options.text - the user message of the turn that just ran.
 * @param {string} [options.assistant] - what the assistant answered.
 * @param {number} [options.cardMaxChars]
 * @param {number} [options.assistantMaxChars]
 * @param {number} options.timeoutMs
 * @param {AbortSignal} [options.signal]
 * @param {(message: string) => void} [options.debug]
 * @returns {Promise<string>} the new card, empty when the model produced nothing.
 */
export async function summarizeCard({ llm, provider, model, card, text, assistant, cardMaxChars = CARD_MAX_CHARS, assistantMaxChars = CARD_INPUT_CHARS, timeoutMs, signal, debug, onUsage }) {
  const known = typeof card === 'string' && card.trim() !== '' ? card.trim().slice(0, cardMaxChars) : '（空）'
  const reply = typeof assistant === 'string' && assistant.trim() !== ''
    ? assistant.trim().slice(0, assistantMaxChars)
    : '（这一轮没有文字回复）'
  const message = typeof text === 'string' ? text.slice(0, TEXT_MAX_CHARS) : ''
  const prompt = `${cardInstruction(cardMaxChars)}\n\n旧便签：\n${known}\n\n用户新消息：\n${message}\n\n助手回复（节选）：\n${reply}`
  const { text: answer } = await call({ llm, provider, model, system: CARD_SYSTEM, prompt, maxTokens: 320, timeoutMs, signal, debug, onUsage })
  return answer.trim().replace(/^card\s*[:：]\s*/i, '').replace(/\s+/g, ' ').slice(0, cardMaxChars)
}
