/**
 * dsh-auto-effort — choose the reasoning effort for every user turn.
 *
 * How a level is picked
 * ---------------------
 * A judge model call reads the newest user message plus a short "task card" of
 * the conversation (what it is doing, what is left) and answers one word:
 * off / low / high / max. See `judge.js`. The card is rewritten in the
 * background after each turn, so the judge always sees what the conversation is
 * about without paying for a growing transcript.
 *
 * Why this hooks `agent.followup` instead of `agent/pre-step`
 * ----------------------------------------------------------
 * `dsh-agent-loop` captures the selection *before* it runs the `agent/pre-step`
 * waterfall:
 *
 *     const selection = this.model.current()      // ← captured here
 *     const decision = await this.dispatch.waterfall('agent/pre-step', ...)
 *     return { ...decision, selection, toolSet }        // ← our select() arrives too late
 *
 * so a select() made inside `agent/pre-step` only applies to the *next* step.
 * `agent/request` is worse: the host rejects a request whose effort differs from
 * the captured selection ("use agent.model.select() before step preparation").
 * The desktop controller calls `agent.followup(message)` / `agent.steer(message)`
 * without awaiting it, after the prompt has been accepted and *before* the
 * message is queued, so wrapping that call is the one place where the level can
 * still be chosen for the turn the user just sent. Only `agent.model.select()`
 * is used, so the host stays in charge of assembly.
 *
 * One level per turn. Every request in a turn is one API conversation, and a
 * thinking-mode request must carry back the `thinking` blocks of the earlier
 * assistant messages. A turn that started at `off` has none, so raising the
 * level halfway makes the API reject the request with
 *   The `content[].thinking` in the thinking mode must be passed back to the API.
 * The level is therefore decided once, before the turn starts, and never
 * changed while that turn runs.
 *
 * Only Agents created after the plugin loads are wrapped, so start a new session
 * (or restart the app) after installing/updating.
 */
import { appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveConfig } from './config.js'
import { judgeLevel, summarizeCard } from './judge.js'
import { publish, resetStates, stateOf } from './state.js'
import { forget, record, setStatus, sessionStatus } from './stats.js'
import { start as startStatsServer, setCompatibility, setSwitchHandler } from './server.js'

const WRAPPED = new WeakSet()

/** Consecutive judge failures before this conversation gives up and goes manual. */
const FAILURES_BEFORE_MANUAL = 3

/** The background card call may run while the user already reads the answer. */
const CARD_TIMEOUT_MS = 10_000

export { Config } from './schema.js'

/** Session id → agent, so the menu switch can reach one conversation. */
const agentsBySession = new Map()

/**
 * The conversation this half touched last. The menu occasionally renders a row
 * without a session id (or with an id we have not seen yet); falling back to this
 * beats a switch that silently does nothing.
 * @type {object | null}
 */
let lastAgent = null

/**
 * Live auto/manual default. `mode` is declared volatile in `schema.js`, so the
 * host hands this plugin a live reference instead of a frozen value. It is only
 * the default for new conversations now: the menu row switches this
 * conversation, and it lives in the per-agent state.
 */
let liveMode = 'manual'
let settingsCtx = null

/** Problems found at load; the plugin page reads them through the sidecar. */
let compatProblems = []

/**
 * The llm service to judge with. A wrapper keeps the ctx it was installed with,
 * and reloading the plugin disposes that ctx - the service then answers "cannot
 * get required service "llm" in inactive context". Prefer the ctx of the most
 * recent apply, so a wrapper installed before the reload keeps working.
 */
function liveLlm(ctx) {
  const host = globalThis.__dshAutoEffort
  if (host !== null && typeof host === 'object' && host.ctx?.llm !== undefined) return host.ctx.llm
  const fresh = settingsCtx
  if (fresh !== null && typeof fresh === 'object' && fresh.llm !== undefined) return fresh.llm
  return ctx.llm
}

/**
 * How many `agent.model.select()` calls are currently ours. Every selection the
 * plugin makes passes through `selectLevel()`, which raises this counter first;
 * the wrapped `agent.model.select` consumes it. A select that arrives with the
 * counter at zero was made by someone else — the user picking a level — and that
 * always wins, even when the value equals the one we set.
 */
let selfSelects = 0

/** Volatile config fields arrive as references read through `.get()`. */
function liveValue(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') return value.get()
  return value
}

/** The default mode for new conversations, read from the settings document. */
function switchSnapshot() {
  try {
    const rows = settingsCtx?.settings?.describe?.() ?? []
    const mine = rows.find(row => row.ns === 'auto-effort')
    return { mode: mine?.value?.mode, revision: mine?.revision }
  } catch {
    return null
  }
}

function modeNow() {
  const snapshot = switchSnapshot()
  if (snapshot?.mode === 'auto' || snapshot?.mode === 'manual') return snapshot.mode
  return liveMode
}

/**
 * Move the session's reasoning level. This is the ONLY way the plugin selects:
 * the counter marks the call as ours so the wrapper on `agent.model.select` can
 * tell our selections apart from the user's.
 */
function selectLevel(agent, selection) {
  selfSelects += 1
  try {
    return agent.model.select(selection)
  } finally {
    if (selfSelects > 0) selfSelects -= 1
  }
}

/**
 * The reasoning levels this model actually advertises.
 *
 * A host LLM adapter publishes `reasoning.efforts` per model, and a model that
 * thinks only when it wants to may publish a short list - a DeepSeek connection
 * with thinking turned off advertises `off` alone. Selecting a level that is not
 * in that list makes the real request fail (`UNSUPPORTED_REASONING_EFFORT`), and
 * unlike the judge call it has no retry, so the plugin must not try.
 */
async function supportedLevels(ctx, current, config) {
  if (typeof ctx?.llm?.resolveModelInfo !== 'function') return config.levels.slice()
  try {
    const info = await ctx.llm.resolveModelInfo(current.provider, current.model)
    const efforts = info?.reasoning?.efforts
    if (!Array.isArray(efforts)) return []
    return efforts.map(effort => String(effort?.id ?? effort)).filter(id => id !== '')
  } catch (error) {
    ctx?.logger?.debug?.(`could not resolve model info: ${error instanceof Error ? error.message : String(error)}`)
    return config.levels.slice()
  }
}

/** Confirm that a selection really landed: read the host's own view back. */
function verifySelection(agent, target, logger) {
  const after = agent?.model?.current?.()
  const got = after?.reasoningEffort
  if (got === target) return
  const problem = `agent.model.select() did not change model.current(): asked for "${target}", read back "${String(got)}"`
  logger.warn(problem)
  if (!compatProblems.includes(problem)) {
    compatProblems.push(problem)
    setCompatibility(compatProblems)
  }
}

/** The judge needs the host LLM runtime; Cordis only exposes it when declared. */
export const inject = ['llm', 'settings']

/** The exact host-side failure this plugin must never cause. */
const THINKING_ERROR = /content\[\]\.thinking|thinking mode must be passed back/i

function makeLogger(ctx, config) {
  let logger = null
  try {
    logger = typeof ctx.logger === 'function' ? ctx.logger('auto-effort') : null
  } catch {
    logger = null
  }
  const file = config.debug
    ? (config.logFile ?? join(homedir(), '.dsh', 'auto-effort.log'))
    : null
  const write = (level, message) => {
    try {
      const fn = logger?.[level]
      if (typeof fn === 'function') fn.call(logger, message)
    } catch {
      /* logging must never break a turn */
    }
    if (file !== null) {
      try {
        appendFileSync(file, `${new Date().toISOString()} ${level.toUpperCase()} ${message}\n`)
      } catch {
        /* a log file problem must never break a turn */
      }
    }
  }
  return {
    debug: message => write('debug', message),
    info: message => write('info', message),
    warn: message => write('warn', message),
  }
}

/** The session id used as the key of the cost rows. */
function sessionIdOf(agent) {
  const id = agent?.session?.header?.id ?? agent?.session?.id ?? agent?.id
  return typeof id === 'string' ? id : ''
}

/** The text of a message, or null when it carries no prose (images only, empty). */
function promptText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return null
  const parts = []
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '') parts.push(block.text)
  }
  if (parts.length === 0) return null
  return parts.join('\n')
}

/**
 * Only a real user turn is judged: retries, goal continuation, notices and
 * tool-delivered messages must never spend a judge call or move the level.
 */
function isUserTurn(message) {
  if (message?.source?.kind !== 'user') return false
  if (message?.source?.form === 'notice') return false
  return promptText(message) !== null
}

/**
 * `judgeModel` may be empty or "model" (judge with the conversation's own
 * model), "provider/model", or a bare model id on the conversation's provider.
 */
function judgeRoute(judgeModel, current) {
  const wanted = typeof judgeModel === 'string' ? judgeModel.trim() : ''
  const provider = current?.provider ?? ''
  if (wanted === '' || /^model$/i.test(wanted)) return { provider, model: current?.model ?? '' }
  const slash = wanted.indexOf('/')
  if (slash > 0) return { provider: wanted.slice(0, slash), model: wanted.slice(slash + 1) }
  return { provider, model: wanted }
}

/**
 * Failures that say nothing about the judge's health: the plugin was being
 * reloaded or the host was disposing when the call went out. Counting them
 * would let a reinstall trip the breaker on its own.
 */
const TRANSIENT_FAILURE = /inactive context|cannot get required service|disposed|aborted|cancell?ed/i

/**
 * Turn one failure into a cause a person can read. The banner shows this instead
 * of "three failures", because the user wants to know what actually went wrong.
 * Order matters: a timeout often also mentions the network, so it goes first.
 */
const FAILURE_KINDS = [
  ['timeout', /timed out|timeout|aborted due to timeout/i],
  ['busy', /\b429\b|rate.?limit|too many requests|overloaded/i],
  ['server', /\b50[0-9]\b|internal server error|bad gateway|service unavailable|upstream error/i],
  ['network', /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|socket hang up|network error|getaddrinfo/i],
  ['noAnswer', /returned no level|no level/i],
  ['notAllowed', /not enabled in config\.levels|not enabled/i],
  ['unsupported', /UNSUPPORTED_REASONING_EFFORT|unsupported reasoning/i],
  ['hostDown', /host llm service is unavailable|cannot get required service/i],
]

/** @returns {'timeout'|'busy'|'server'|'network'|'noAnswer'|'notAllowed'|'unsupported'|'hostDown'|'unknown'} */
function classifyFailure(detail) {
  for (const [kind, pattern] of FAILURE_KINDS) {
    if (pattern.test(detail)) return kind
  }
  return 'unknown'
}

/** Record one judge failure; three real ones in a row turn automatic switching off. */
function recordFailure(state, config, logger, agent, error) {
  const detail = error instanceof Error ? error.message : String(error)
  if (TRANSIENT_FAILURE.test(detail)) {
    logger.warn(`judge skipped (transient, not counted): ${detail}`)
    state.reason = `判断暂时不可用（${detail}）`
    publish(agent, state)
    setStatus(sessionIdOf(agent), { auto: state.auto && !state.tripped, tripped: state.tripped, cause: state.tripped ? state.pauseCause : null, failCause: state.failCause })
    return
  }
  state.failures += 1
  state.failCause = classifyFailure(detail)
  logger.warn(`judge failed (${state.failures}x, ${state.failCause}): ${detail}`)
  if (state.failures >= FAILURES_BEFORE_MANUAL) {
    state.auto = false
    state.tripped = true
    state.pauseCause = 'failures'
    state.source = 'manual'
    state.reason = `连续 ${FAILURES_BEFORE_MANUAL} 次失败（最后一次：${detail}），已停止自动选择`
    publish(agent, state)
    setStatus(sessionIdOf(agent), { auto: false, tripped: true, cause: 'failures', failCause: state.failCause })
    return
  }
  if (config.defaultLevel !== null) {
    const current = agent.model.current()
    if (current?.provider !== undefined && current?.model !== undefined) {
      try {
        selectLevel(agent, { ...current, reasoningEffort: config.defaultLevel })
        state.level = config.defaultLevel
        state.source = 'auto'
        state.reason = `失败（${detail}），回退到 ${config.defaultLevel}`
        publish(agent, state)
        setStatus(sessionIdOf(agent), { auto: true, tripped: false })
        return
      } catch {
        /* fall through to the plain "keep manual" reason */
      }
    }
  }
  state.reason = `失败，保持当前等级（${detail}）`
  publish(agent, state)
  setStatus(sessionIdOf(agent), { auto: state.auto && !state.tripped, tripped: state.tripped, cause: state.tripped ? state.pauseCause : null, failCause: state.failCause })
}

/**
 * Judge one prompt and apply the level the turn should run at.
 * Throws on judge/host trouble; the caller turns that into a recorded failure.
 * @returns {Promise<string|null>} the level this turn runs at, or null.
 */
async function decide(ctx, agent, state, config, logger, message) {
  const current = agent.model.current()
  if (current === undefined || current?.provider === undefined || current?.model === undefined) {
    state.reason = '当前会话没有可用的模型选择，未参与自动选择'
    publish(agent, state)
    return null
  }
  const text = promptText(message)
  if (text === null) return null

  state.judgedTurns += 1
  // Never log message text: the log is a plain file under the user's home and a
  // judge input can be private. Lengths are enough to debug a stale card.
  logger.info(`turn ${state.judgedTurns} judging (${text.length} chars, card=${state.card === '' ? 'empty' : `${state.card.length} chars`})`)
  // The turn about to run: the background card writer reads it after the turn
  // finishes, so the assistant reply can be folded in.
  state.pendingText = text
  state.pendingAssistant = ''

  const route = judgeRoute(config.judgeModel, current)
  const startedJudge = Date.now()
  let judgeUsage
  const judged = await judgeLevel({
    llm: liveLlm(ctx),
    provider: route.provider,
    model: route.model,
    text,
    card: state.card,
    cardMaxChars: config.cardMaxChars,
    timeoutMs: config.timeoutMs,
    signal: agent.lifetimeSignal ?? undefined,
    onUsage: usage => { judgeUsage = usage },
    debug: config.debug === true ? message => logger.debug(`level ${message}`) : undefined,
  })
  state.judgeRoute = route
  const judgeMs = Date.now() - startedJudge
  logger.debug(`level call took ${judgeMs}ms`)
  record({ sessionId: sessionIdOf(agent), kind: 'judge', ms: judgeMs, usage: judgeUsage })

  // The judge takes a moment. If the user changed the model, closed the switch or
  // picked a level by hand while it ran, that choice wins over this judgement.
  const after = agent.model.current()
  if (state.auto === false || state.tripped === true) {
    state.reason = '自动选择在判断期间被关掉了，本轮未调整'
    publish(agent, state)
    logger.info(`turn ${state.judgedTurns}: ${judged} not applied (auto was switched off meanwhile)`)
    return null
  }
  if (after?.provider !== current.provider || after?.model !== current.model) {
    state.reason = '判断期间换了模型，本轮未调整'
    publish(agent, state)
    logger.info(`turn ${state.judgedTurns}: ${judged} not applied (the model changed meanwhile)`)
    return null
  }

  if (!config.levels.includes(judged)) {
    throw new Error(`judge returned "${judged}", which is not enabled in config.levels`)
  }
  const target = config.requireMaxForUpgrade && judged === 'max' ? 'high' : judged
  state.judgedLevel = judged

  // Only ask for a level this model advertises; otherwise leave the turn alone.
  const supported = await supportedLevels(ctx, current, config)
  if (!supported.includes(target)) {
    state.reason = supported.length === 0
      ? '当前模型不提供推理等级，本轮未调整'
      : `当前模型只支持 ${supported.join('/')}，本轮判断 ${judged} 未应用`
    publish(agent, state)
    logger.info(`turn ${state.judgedTurns}: ${judged} not applied (model supports ${supported.join('/') || 'none'})`)
    setStatus(sessionIdOf(agent), { auto: true, tripped: false, supported: supported.length > 0 })
    return null
  }
  selectLevel(agent, { provider: current.provider, model: current.model, reasoningEffort: target })
  verifySelection(agent, target, logger)
  state.level = target
  state.source = 'auto'
  state.reason = `判断为 ${judged}${target === judged ? '' : `，按设置切到 ${target}`}`
  state.failures = 0
  state.failCause = null
  publish(agent, state)
  logger.info(`turn ${state.judgedTurns}: ${judged} -> ${target}`)
  setStatus(sessionIdOf(agent), { auto: true, tripped: false })
  return target
}

/**
 * Send one user prompt as a fresh turn: judge it, then hand it to the host.
 * The controller does not await followup/steer, so this promise is fire-and-forget.
 */
function dispatch(ctx, agent, state, config, logger, method, message, rest, fromQueue = false) {
  const original = state.hostDispatch?.[method]
  const send = () => (typeof original === 'function'
    ? original.call(agent, message, ...rest)
    : agent[method](message, ...rest))
  return (async () => {
    try {
      await decide(ctx, agent, state, config, logger, message)
    } catch (error) {
      // Bookkeeping must never cost the user their message: whatever happens
      // while recording the failure, the message still goes out below.
      try {
        recordFailure(state, config, logger, agent, error)
      } catch (recording) {
        logger.warn(`could not record the failure: ${recording instanceof Error ? recording.message : String(recording)}`)
      }
    }
    // A turn may have started while the judge was thinking (another client, a
    // resumed run). Moving the level then would contradict the thinking blocks
    // the running turn already sent, so this message waits for the next turn.
    if (!fromQueue && state.running) {
      state.held.unshift({ method, message, rest })
      logger.info('a turn started while judging; the message waits for it to stop')
      return undefined
    }
    return send()
  })()
}

/**
 * Deliver the oldest held message as a new turn. Called when a turn stops, so a
 * message sent while the agent was busy is judged against what that turn just
 * did — exactly as if the user had waited and sent it again.
 */
function flushHeld(ctx, agent, state, config, logger) {
  // A turn is running, or the card for the last one is still being written, or a
  // delivery is already in flight: delivering now would put a second message into
  // a turn whose level was chosen for the first one.
  if (state.flushing || state.running || state.cardPending || state.held.length === 0) return
  const next = state.held.shift()
  if (next === undefined) return
  // A closed conversation must not be handed a message: `lifetimeSignal` is what
  // the host aborts on dispose (`agent.disposed` does not exist).
  if (agent?.lifetimeSignal?.aborted === true) {
    logger.info('a message held while the agent ran was dropped: the conversation is closed')
    return
  }
  state.flushing = true
  // The turn this message is about to start is "running" from now on. Without
  // this, a third message arriving during the judge below would be sent straight
  // away and could reach the host before the one being flushed.
  state.running = true
  logger.info(`delivering a message that waited for the running turn (${state.held.length} left)`)
  Promise.resolve()
    .then(() => dispatch(ctx, agent, state, config, logger, next.method, next.message, next.rest, true))
    .catch(error => logger.warn(`a held message could not be delivered: ${error instanceof Error ? error.message : String(error)}`))
    .finally(() => {
      state.flushing = false
    })
}

function attach(ctx, agent, config, logger) {
  if (agent === null || typeof agent !== 'object' || WRAPPED.has(agent)) return
  // Subagent sessions are not user turns: judging them would spend a call on
  // every delegated task and, because the subagent manager disposes a child that
  // has not started a step yet, delaying their prompt breaks the run.
  const origin = agent.session?.header?.origin ?? agent.session?.origin
  if (origin === 'subagent') {
    logger.debug(`skipped subagent session ${String(agent.session?.header?.id)}`)
    return
  }
  const state = stateOf(agent, config)
  // `mode` is the default for conversations created from now on; once this
  // conversation has its own state, the menu switch alone decides. Re-applying
  // the default here would undo a switch the user just flipped on.
  if (!config.enabled) state.auto = false
  const sessionId = sessionIdOf(agent)
  if (sessionId !== '') agentsBySession.set(sessionId, agent)
  lastAgent = agent
  setStatus(sessionId, { auto: state.auto && !state.tripped, tripped: state.tripped, cause: state.tripped ? state.pauseCause : null, failCause: state.failCause })

  // Watch the session's level. Anything the plugin did not select itself is the
  // user taking over: switch auto off for THIS conversation, before the next
  // message is sent.
  try {
    const model = agent.model
    if (model !== null && typeof model === 'object' && typeof model.select === 'function' && model.__autoEffortWatched !== true) {
      const originalSelect = model.select.bind(model)
      model.select = function autoEffortWatchedSelect(selection) {
        if (selfSelects > 0) {
          selfSelects -= 1
          return originalSelect(selection)
        }
        // Re-applying the level a conversation already had (what the host does
        // on restart) is not a decision by the user: it must not switch auto off.
        const before = model.current?.()?.reasoningEffort
        if (selection?.reasoningEffort === before) return originalSelect(selection)
        if (state.auto && !state.tripped) {
          state.auto = false
          state.source = 'manual'
          state.level = selection?.reasoningEffort ?? state.level
          state.reason = '你手动选了推理等级，本对话不再自动选择'
          publish(agent, state)
          logger.info(`manual selection detected (${String(selection?.reasoningEffort)}), auto off for this conversation`)
          setStatus(sessionId, { auto: false, tripped: false, cause: null })
        }
        return originalSelect(selection)
      }
      model.__autoEffortWatched = true
    }
  } catch (error) {
    logger.debug(`cannot watch model.select: ${error instanceof Error ? error.message : String(error)}`)
  }

  let wrappedAny = false
  for (const method of ['followup', 'steer']) {
    const original = agent[method]
    if (typeof original !== 'function') continue
    state.hostDispatch = { ...(state.hostDispatch ?? {}), [method]: original }
    let assigned = false
    try {
      const previous = agent[method]
      agent[method] = function autoEffortDispatch(message, ...rest) {
        const active = config.enabled && state.auto && !state.tripped && isUserTurn(message)
        if (!active) {
          if (state.tripped) {
            logger.warn(`${method} skipped: auto is off for this conversation after repeated failures; switch it back on to retry`)
          } else {
            logger.debug(`${method} skipped (auto=${state.auto}, tripped=${state.tripped}, kind=${String(message?.source?.kind)})`)
          }
          return original.call(agent, message, ...rest)
        }
        if (state.running && state.turnSignal?.aborted === true) {
          // The turn was stopped while this message was on its way to the queue.
          // There is nothing left to wait for, so send it as a new turn.
          state.running = false
          logger.info('the turn had already been stopped; sending the message instead of holding it')
        }
        if (state.running || state.deciding || state.cardPending) {
          if (method === 'steer' && state.running) {
            // "Steer" hands the message to the turn already running, so it keeps
            // that turn's level; nothing to judge and nothing to select.
            logger.info('steer passed through untouched: it keeps the level of the running turn')
            return original.call(agent, message, ...rest)
          }
          // "Queue" waits for the running turn to stop; then this message gets
          // its own judgement and its own turn, instead of inheriting a level
          // picked for the previous message. A message that arrives while the
          // previous one is still being judged waits here too: two judgements at
          // once would race to set the level of the same turn.
          state.held.push({ method, message, rest })
          logger.info(`message held until the running turn stops (${state.held.length} waiting)`)
          return undefined
        }
        state.deciding = true
        return dispatch(ctx, agent, state, config, logger, method, message, rest)
          .catch(error => logger.warn(`the message could not be sent: ${error instanceof Error ? error.message : String(error)}`))
          .finally(() => { state.deciding = false })
      }
      assigned = agent[method] !== previous
    } catch (error) {
      logger.warn(`cannot wrap agent.${method}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (assigned) wrappedAny = true
  }
  if (wrappedAny) {
    WRAPPED.add(agent)
    logger.info(`agent ${String(agent.id ?? agent.session?.id ?? '?')} wrapped`)
  }
}

/**
 * Circuit breaker: the thinking round-trip error means a request was assembled
 * against an inconsistent level. Stop automatic switching for that conversation
 * at once instead of repeating the failure every turn.
 */
function trip(payload, logger) {
  const agent = payload?.agent ?? payload
  const error = payload?.error ?? payload
  const text = String(error?.message ?? error?.data?.message ?? error ?? '')
  const state = agent && typeof agent === 'object' ? stateOf(agent, { enabled: false }) : null
  if (state === null || !THINKING_ERROR.test(text)) return
  state.auto = false
  state.tripped = true
  state.pauseCause = 'thinking'
  state.source = 'manual'
  state.level = agent.model?.current?.()?.reasoningEffort ?? state.level
  state.reason = `检测到 thinking 回传错误，已停止自动选择：${text.slice(0, 120)}`
  publish(agent, state)
  setStatus(sessionIdOf(agent), { auto: false, tripped: true, cause: 'thinking' })
  logger.warn(`circuit breaker tripped: ${text.slice(0, 200)}`)
}

/** Everything the plugin needs from the host, checked once at load. */
function selfCheck(ctx) {
  const problems = []
  if (typeof ctx?.on !== 'function') problems.push('ctx.on is missing (agent hooks cannot be registered)')
  if (typeof ctx?.llm?.prepareCall !== 'function') problems.push('ctx.llm.prepareCall is missing (the judge call cannot run)')
  if (typeof ctx?.settings?.describe !== 'function') problems.push('ctx.settings.describe is missing (the default switch cannot be read)')
  return problems
}

/**
 * Host plugin entry point.
 * @param {object} ctx - the plugin's scoped Cordis context.
 * @param {unknown} rawConfig - config from `cordis.patch.yml`.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const logger = makeLogger(ctx, config)
  settingsCtx = ctx
  globalThis.__dshAutoEffort = { ctx }
  const problems = selfCheck(ctx)
  for (const problem of problems) logger.warn(`incompatible with this DSH build: ${problem}`)
  compatProblems = problems.slice()
  setCompatibility(compatProblems)
  // Deliberately NOT resetStates(): a hot reload leaves the already-attached
  // conversations running the previous wrapper, and replacing their state objects
  // here would leave those wrappers and the new event handlers looking at two
  // different objects — the exact mix-up that makes messages wait forever.
  agentsBySession.clear()
  liveMode = liveValue(config.mode) === 'auto' ? 'auto' : 'manual'
  logger.info(`loaded (default mode=${liveMode}, enabled=${config.enabled}, judge=${config.judgeModel}, timeout=${config.timeoutMs}ms)`)

  // The menu row switches one conversation through this loopback sidecar: the
  // settings document is the default for new conversations, not a per-session
  // value, and writing it on every click rewrites the profile patch.
  setSwitchHandler((sessionId, on) => {
    const want = String(sessionId)
    // The menu hands over the id it renders; the map is keyed by the id the host
    // reports. They can differ by the `session-` prefix, so match on the bare id
    // too, and fall back to the only conversation when there is just one.
    let agent = agentsBySession.get(want)
    if (agent === undefined) {
      const bare = want.replace(/^session-/, '')
      for (const [key, value] of agentsBySession) {
        if (key.replace(/^session-/, '') === bare) {
          agent = value
          break
        }
      }
    }
    if (agent === undefined && agentsBySession.size === 1) agent = agentsBySession.values().next().value
    // A missing id means "the conversation the user is looking at", and the menu
    // belongs to the conversation that ran last. An id that matches nothing is
    // different: acting on the last conversation then would silently switch the
    // wrong one, so it is reported instead.
    if (agent === undefined && want === '') agent = lastAgent ?? undefined
    const state = agent === undefined ? null : stateOf(agent, config)
    if (state === null) {
      logger.warn(`switch: no conversation matches ${want}`)
      return null
    }
    const realId = sessionIdOf(agent) || want
    state.auto = on === true
    if (state.auto) {
      state.tripped = false
      state.pauseCause = null
      state.failures = 0
      state.failCause = null
      state.source = 'auto'
      state.reason = '你打开了自动选择，恢复自动'
    } else {
      state.tripped = false
      state.pauseCause = null
      state.source = 'manual'
      state.level = agent.model?.current?.()?.reasoningEffort ?? state.level
      state.reason = '你关掉了这个对话的自动选择'
    }
    publish(agent, state)
    setStatus(realId, { auto: state.auto && !state.tripped, tripped: state.tripped, cause: state.tripped ? state.pauseCause : null, failCause: state.failCause })
    logger.info(`switch for this conversation set to ${state.auto ? 'auto' : 'manual'}`)
    return sessionStatus(realId) ?? null
  })

  // The numbers shown in the menu and on the plugin page travel over a loopback
  // HTTP sidecar: writing settings every turn would rewrite the profile patch,
  // which is what once disturbed the composer.
  const stopStats = () => { statsServer?.close?.().catch(() => {}) }
  let statsServer = null
  let statsStopped = false
  startStatsServer({ logger }).then(
    server => {
      if (statsStopped === true) {
        // The plugin was unloaded while the port was being bound: close at once so
        // the stale sidecar cannot shadow the next instance.
        server.close().catch(() => {})
        return
      }
      statsServer = server
      if (typeof ctx.effect === 'function') {
        try {
          ctx.effect(() => () => server.close().catch(() => {}), 'auto-effort: cost display server')
        } catch {
          /* an inactive context cannot register the effect; dispose covers it */
        }
      }
    },
    error => logger.warn(`cost display unavailable: ${error instanceof Error ? error.message : String(error)}`),
  )
  ctx.on?.('dispose', () => {
    statsStopped = true
    stopStats()
    agentsBySession.clear()
    setSwitchHandler(null)
  })

  // A conversation that is gone for good: drop its rows so the maps do not grow
  // for the life of the process. The running total keeps what it already counted.
  ctx.on?.('agent/disposed', payload => {
    try {
      const agent = payload?.agent ?? payload
      const sid = sessionIdOf(agent)
      if (sid === '') return
      agentsBySession.delete(sid)
      forget(sid)
      resetStates(agent)
      logger.debug(`forgot conversation ${sid}`)
    } catch {
      /* best effort */
    }
  })

  // Archiving is the other way a conversation leaves the list. The host announces
  // it after the archive is durable, so the rows can go at the same moment.
  ctx.on?.('workspace/session-archived', request => {
    try {
      const sid = String(request?.sessionId ?? request?.id ?? '')
      if (sid === '') return
      agentsBySession.delete(sid)
      forget(sid)
      logger.debug(`forgot archived conversation ${sid}`)
    } catch {
      /* best effort */
    }
  })

  ctx.on('agent/created', payload => {
    const agent = payload?.agent ?? payload
    try {
      // Register before the first message: the menu switch must be able to reach
      // a conversation that has not been used yet.
      const sid = sessionIdOf(agent)
      if (sid !== '') agentsBySession.set(sid, agent)
    } catch {
      /* best effort */
    }
    try {
      attach(ctx, agent, config, logger)
    } catch (error) {
      logger.warn(`attach failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  // A step boundary means a turn is running: from here on a queued message waits
  // instead of being sent.
  ctx.on('agent/pre-step', (payload, next) => {
    try {
      logger.debug(`pre-step turn=${payload?.turn} step=${payload?.step} current=${String(payload?.agent?.model?.current?.()?.reasoningEffort)} auto=${String(stateOf(payload?.agent, config).auto)}`)
      const runningAgent = payload?.agent
      if (runningAgent !== null && typeof runningAgent === 'object') {
        const state = stateOf(runningAgent, config)
        state.running = true
        // Pressing Stop aborts the turn's signal and fires no `turn-stopping`.
        // Watch the signal, or a held message waits behind a turn that is already
        // dead and the conversation goes quiet.
        const signal = payload?.signal
        if (signal !== null && typeof signal === 'object' && typeof signal.addEventListener === 'function' && state.turnSignal !== signal) {
          state.turnSignal = signal
          signal.addEventListener('abort', () => {
            try {
              state.running = false
              logger.info('the running turn was stopped; any held message can go now')
              setImmediate(() => {
                try {
                  flushHeld(ctx, runningAgent, state, config, logger)
                } catch {
                  /* never throw out of a host hook */
                }
              })
            } catch {
              /* best effort */
            }
          }, { once: true })
        }
        const sid = sessionIdOf(runningAgent)
        if (sid !== '') agentsBySession.set(sid, runningAgent)
      }
    } catch {
      /* logging only */
    }
    return next()
  })

  for (const hook of ['agent/error', 'agent/request-error']) {
    ctx.on(hook, payload => {
      try {
        trip(payload, logger)
      } catch {
        /* a breaker must never throw into the host */
      }
      // A turn that dies does not fire `turn-stopping`, so the running flag has
      // to be cleared here too — otherwise every later message would be held
      // behind a turn that will never stop.
      try {
        const agent = payload?.agent ?? payload
        if (agent !== null && typeof agent === 'object') {
          const state = stateOf(agent, config)
          state.running = false
          setImmediate(() => {
            try {
              flushHeld(ctx, agent, state, config, logger)
            } catch {
              /* never throw out of a host hook */
            }
          })
        }
      } catch {
        /* a failed turn must not break the hook */
      }
    })
  }

  // Collect the assistant text of the running turn for the background card
  // writer. Nothing is decided here, so a failure is never visible to the user.
  ctx.on('agent/assistant-stream', payload => {
    try {
      const agent = payload?.agent
      const state = agent !== null && typeof agent === 'object' ? stateOf(agent, config) : null
      if (state === null) return
      const frame = payload?.frame
      const chunk = frame?.chunk ?? frame
      const kind = chunk?.type ?? chunk?.kind
      if ((kind === 'text-delta' || kind === 'text') && typeof chunk?.text === 'string') {
        state.pendingAssistant = (state.pendingAssistant + chunk.text).slice(-4000)
      }
    } catch {
      /* collecting is best effort */
    }
  })

  // The authoritative answer to "is a turn still running": the host announces
  // it. `turn-stopping` and the abort signal both miss cases (a turn that dies
  // quietly, a turn replaced by a restart), and a missed release leaves every
  // later message waiting behind a turn that will never stop.
  ctx.on('agent/status', payload => {
    try {
      const agent = payload?.agent
      if (agent === null || typeof agent !== 'object') return
      const state = stateOf(agent, config)
      if (payload?.status === 'running') {
        state.running = true
        return
      }
      if (payload?.status !== 'idle') return
      const wasRunning = state.running
      state.running = false
      const sid = sessionIdOf(agent)
      if (sid !== '') agentsBySession.set(sid, agent)
      if (wasRunning && state.held.length > 0) {
        logger.info(`the conversation went idle; delivering a message that waited (${state.held.length} waiting)`)
      }
      setImmediate(() => {
        try {
          flushHeld(ctx, agent, state, config, logger)
        } catch {
          /* never throw out of a host hook */
        }
      })
    } catch {
      /* a status change must never break the hook */
    }
  })

  // The card is rewritten OUTSIDE the user's blocking path: this listener returns
  // before the call finishes, so the turn never waits for it.
  ctx.on('agent/turn-stopping', payload => {
    try {
      const agent = payload?.agent
      if (agent === null || typeof agent !== 'object') return
      const state = stateOf(agent, config)
      if (!state.auto || state.tripped || state.judgeRoute === null || state.pendingText === '') {
        state.running = false
        flushHeld(ctx, agent, state, config, logger)
        return
      }
      const card = state.card
      const text = state.pendingText
      const assistant = state.pendingAssistant
      const route = state.judgeRoute
      state.pendingText = ''
      state.pendingAssistant = ''
      const started = Date.now()
      let cardUsage
      const cardPromise = summarizeCard({
        llm: liveLlm(ctx),
        provider: route.provider,
        model: route.model,
        card,
        text,
        assistant,
        cardMaxChars: config.cardMaxChars,
        assistantMaxChars: config.cardInputChars,
        timeoutMs: CARD_TIMEOUT_MS,
        onUsage: usage => { cardUsage = usage },
        debug: config.debug === true ? message => logger.debug(`card ${message.replace(/raw="[\s\S]*"/, match => `raw=<${match.length} chars>`)}`) : undefined,
      }).then(
        next => {
          if (next !== '') state.card = next
          const cardMs = Date.now() - started
          logger.debug(`task card updated in ${cardMs}ms (${state.card.length} chars)`)
          record({ sessionId: sessionIdOf(agent), kind: 'card', ms: cardMs, usage: cardUsage })
        },
        error => logger.debug(`task card skipped: ${error instanceof Error ? error.message : String(error)}`),
      )
      // The turn is over, but a queued message must not overtake the card write:
      // it is judged against the card that describes the turn that just ended.
      state.cardPending = true
      // The held message is judged against the card written for the turn that
      // just stopped, so give the card writer a chance to land first — but never
      // make the user wait the whole card timeout for it.
      void Promise.race([
        cardPromise.catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])
        .catch(() => {})
        .then(() => {
          state.cardPending = false
          state.running = false
          flushHeld(ctx, agent, state, config, logger)
        })
    } catch (error) {
      logger.debug(`task card skipped: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}
