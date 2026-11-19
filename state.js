/**
 * Per-agent runtime state.
 *
 * Everything the plugin decides for a conversation lives here: the current
 * level the plugin last applied, where that level came from (手动 / 自动), the
 * judge's reason for this turn, the task card, and the messages that arrived
 * while the agent was busy. The UI reads the published snapshot instead of the
 * agent internals.
 */

/** @typedef {'manual' | 'auto'} LevelSource */

let states = new WeakMap()

/**
 * Drop every per-conversation state. Called when the plugin is (re)applied, so a
 * latched breaker or a stale card never survives a reload.
 */
export function resetStates() {
  states = new WeakMap()
}

/** Latest snapshot per session id, so a dock widget can render without the Agent. */
export const published = new Map()

/**
 * State of one agent, created on first use.
 * @param {object} agent
 * @param {{ enabled: boolean }} config
 */
export function stateOf(agent, config) {
  let state = states.get(agent)
  if (state === undefined) {
    state = {
      /** Master switch for THIS conversation: false means the plugin never touches the level. */
      auto: config.enabled && config.mode !== 'manual',
      /** True once automatic switching stopped on its own. */
      tripped: false,
      /**
       * Why it stopped: 'failures' when the judge kept failing, 'thinking' when
       * the conversation hit the thinking round-trip error. The banner wording
       * depends on it, so it is not just a log detail.
       */
      pauseCause: /** @type {'failures' | 'thinking' | null} */ (null),
      /**
       * Why the judge failed last: timeout / busy / server / network / noAnswer /
       * notAllowed / unsupported / hostDown / unknown. The banner names it.
       */
      failCause: /** @type {string | null} */ (null),
      /** Level the plugin last applied, or null before the first judgement. */
      level: null,
      /** Who owns the current level. */
      source: /** @type {LevelSource} */ ('manual'),
      /** What the judge said, plus what happened with it, shown in the UI. */
      reason: '本轮还没有判断',
      /** Number of user turns judged so far. */
      judgedTurns: 0,
      /** Consecutive judge failures. */
      failures: 0,
      /** What the judge said for the turn running now (off/low/high/max). */
      judgedLevel: null,
      /** True from the first step of a turn until that turn stops. */
      running: false,
      /**
       * Abort signal of the turn running now. Pressing Stop aborts it and fires
       * no `turn-stopping`, so the signal is what tells this plugin that a turn
       * is over; without it a held message would wait behind a dead turn.
       */
      turnSignal: /** @type {AbortSignal | null} */ (null),
      /**
       * The task card: at most a couple of lines saying what the conversation is
       * doing and what is left. It is the only cross-turn context the judge sees.
       */
      card: '',
      /** The user message of the turn running now; the card writer reads it. */
      pendingText: '',
      /** Text the assistant produced in this turn, for the card writer. */
      pendingAssistant: '',
      /** Who the judge talks to, remembered so the card call uses the same route. */
      judgeRoute: null,
      /** Messages that arrived while the agent was busy, oldest first. */
      held: [],
      /** True while a held message is being handed to the host. */
      flushing: false,
      /** The host's own followup/steer, before this plugin wrapped them. */
      hostDispatch: null,
    }
    states.set(agent, state)
  }
  return state
}

/**
 * Freeze what the UI has to show for one turn.
 * @param {object} agent
 * @param {ReturnType<typeof stateOf>} state
 */
export function publish(agent, state) {
  const id = agent?.session?.id ?? agent?.id
  if (typeof id !== 'string') return
  published.set(id, Object.freeze({
    level: state.level,
    source: state.source,
    reason: state.reason,
    auto: state.auto && !state.tripped,
    tripped: state.tripped,
    pauseCause: state.pauseCause,
    failCause: state.failCause,
    judgedTurns: state.judgedTurns,
    failures: state.failures,
  }))
}

/**
 * Read the snapshot for a session.
 * @param {string} sessionId
 */
export function snapshotOf(sessionId) {
  return published.get(sessionId)
}
