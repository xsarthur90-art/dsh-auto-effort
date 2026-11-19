/**
 * Client half.
 *
 * 1. One switch inside the composer's model menu, below the four reasoning
 *    levels, plus a second line with this conversation's numbers.
 * 2. A read-only cost panel on the plugin's own detail page.
 *
 * The switch is a switch, not a level: `off/low/high/max` are the only values the
 * API accepts, so "auto" never becomes an effort value. It turns automatic
 * selection on or off for THIS conversation only, through the loopback sidecar
 * (see `server.js`), which reaches that conversation's state directly. The `mode`
 * field of the settings entry is only the default for new conversations, so
 * clicking this row never rewrites the profile patch.
 *
 * The numbers come from the host half over the same sidecar.
 */
window.__ModuleLoader__.load({
  id: 'dsh-auto-effort',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const ENTRY = 'auto-effort'
    // The plugin page keys `plugins.bundle.config` by PACKAGE NAME
    // (`PluginManagerPage.tsx:822` passes `entryKey: pkg.name`), not by the
    // patch row id that the settings entry uses.
    const BUNDLE = 'dsh-auto-effort'
    const AUTO = 'auto'
    const MANUAL = 'manual'
    /** Same list as `server.js`; the first one that answers wins. */
    const PORTS = [53127, 53128, 53129, 53130, 53131]
    // Both figures are DeepSeek's own list prices, never a conversion of one into
    // the other: the Chinese UI shows the CNY list, the English UI the USD list.

    function isEnglish() {
      const lang = String(document?.documentElement?.lang ?? navigator?.language ?? 'zh').toLowerCase()
      return lang.startsWith('en')
    }

    function rowLabel() {
      return isEnglish() ? 'Auto-select effort' : '自动选择推理等级'
    }

    // ---- the cost sidecar -------------------------------------------------

    let basePromise = null
    function statsBase() {
      if (basePromise === null) {
        // A failed probe must not be cached for the life of the page: the page can
        // load before the host binds its port, and a sidecar restart can move the
        // port. Only a base that answered is remembered.
        basePromise = probe().then(base => {
          if (base === null) basePromise = null
          return base
        })
      }
      return basePromise
    }

    async function probe() {
      for (const port of PORTS) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' })
          if (!response.ok) continue
          const body = await response.json()
          if (body?.name === 'dsh-auto-effort') return `http://127.0.0.1:${port}`
        } catch {
          /* not this port */
        }
      }
      return null
    }

    async function readStats(path) {
      const base = await statsBase()
      if (base === null) return null
      try {
        const response = await fetch(`${base}${path}`, { cache: 'no-store' })
        return response.ok ? await response.json() : null
      } catch {
        return null
      }
    }

    /**
     * Turn automatic selection on or off for one conversation. Nothing is written
     * to the settings document: the host half keeps this in that conversation's state.
     */
    async function postSwitch(sessionId, on) {
      const base = await statsBase()
      if (base === null) return null
      try {
        const response = await fetch(`${base}/switch`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ session: sessionId, on }),
        })
        return response.ok ? await response.json() : null
      } catch {
        return null
      }
    }

    /**
     * Leave a trace of a click the host can read back. When a row looks dead this
     * is what tells apart "the click never happened" from "the host said no".
     */
    async function postBeacon(where) {
      const base = await statsBase()
      if (base === null) return
      try {
        await fetch(`${base}/beacon?where=${encodeURIComponent(where)}`, { cache: 'no-store' })
      } catch {
        // A beacon that fails is not worth a log line.
      }
    }

    /** The conversation the menu was last rendered for; the level watcher uses it. */
    let lastSessionId = ''

    function money(stats) {
      const value = Number(isEnglish() ? stats?.usd : stats?.cny) || 0
      const symbol = isEnglish() ? '$' : '¥'
      return value >= 0.01 ? `${symbol}${value.toFixed(2)}` : `${symbol}${value.toFixed(4)}`
    }

    function duration(ms) {
      const seconds = (Number(ms) || 0) / 1000
      if (seconds >= 10) return `${seconds.toFixed(0)}${isEnglish() ? ' s' : ' 秒'}`
      return `${seconds.toFixed(1)}${isEnglish() ? ' s' : ' 秒'}`
    }

    function summaryLine(stats) {
      // A conversation can stop for a reason the user must see, not just a
      // count: the breaker latched after an API error, or the switch was turned
      // off by a manual pick. Say so instead of showing a stale number — but keep
      // the numbers this conversation already spent.
      const count = Number(stats?.count) || 0
      if (stats?.status?.tripped === true) {
        return isEnglish() ? 'Stopped after repeated failures — toggle the switch to retry' : '连续失败，已停止 —— 关一下开关再打开可恢复'
      }
      if (stats?.status?.auto === false) {
        return isEnglish() ? 'Stopped for this conversation' : '本对话已停止'
      }
      if (count === 0) return isEnglish() ? 'No auto run yet' : '还没有自动触发'
      if (isEnglish()) {
        return `${count} run${count === 1 ? '' : 's'} · ${money(stats)} · ${duration(stats.ms)}`
      }
      return `${count} 次 · ${money(stats)} · ${duration(stats.ms)}`
    }

    /** Poll one endpoint while mounted; the menu is short-lived, so 2 s is enough. */
    function useStats(path, intervalMs = 2000) {
      const [stats, setStats] = React.useState(null)
      React.useEffect(() => {
        if (!path) return undefined
        let alive = true
        const tick = async () => {
          const next = await readStats(path)
          if (alive && next !== null) setStats(next)
        }
        tick()
        const timer = setInterval(tick, intervalMs)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [path, intervalMs])
      return stats
    }

    // ---- the switch -------------------------------------------------------

    function readMode(snapshot) {
      const value = snapshot?.value
      if (value === null || typeof value !== 'object') return null
      return value.mode === AUTO ? AUTO : MANUAL
    }

    function AutoRow(ctx, props) {
      let form = null
      try {
        form = ctx.configForms.get(ENTRY)
      } catch {
        form = null
      }
      const [snapshot, setSnapshot] = React.useState(() => (form ? form.getSnapshot() : null))
      const [pending, setPending] = React.useState(false)
      const [hover, setHover] = React.useState(false)
      const [confirmed, setConfirmed] = React.useState(null)
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      if (sessionId !== '') lastSessionId = sessionId
      const stats = useStats(sessionId ? `/stats?session=${encodeURIComponent(sessionId)}` : '')

      React.useEffect(() => {
        if (!form) return undefined
        return form.subscribe(() => setSnapshot(form.getSnapshot()))
      }, [form])

      // This conversation's own state wins. The setting is only the default for
      // new conversations, so it applies until the host reports one.
      const configOn = readMode(snapshot) === AUTO
      const reported = typeof stats?.status?.auto === 'boolean' ? stats.status.auto : null
      // Fall back to the last conversation this menu was rendered for: a slot
      // that omits sessionId must not leave the row dead.
      const target = sessionId !== '' ? sessionId : lastSessionId
      // The host answers the switch request with the status it now holds, so the
      // row can use that answer directly. No guessing: every number shown here
      // came out of the host, and the next poll confirms it either way.
      const on = confirmed ?? reported ?? configOn
      // Always clickable: the host falls back to the conversation it touched last
      // when it cannot resolve this id, so "no id" must not freeze the row.
      const ready = true

      // A fresh poll wins over the answer to an older click.
      React.useEffect(() => { setConfirmed(null) }, [reported, target])

      const toggle = () => {
        if (pending) return
        const next = !on
        setPending(true)
        postBeacon('switch-click')
        postSwitch(target, next)
          .then(result => {
            const applied = result?.status
            if (typeof applied?.auto === 'boolean') setConfirmed(applied.auto)
          })
          .catch(error => ctx.logger?.warn?.(`cannot switch mode: ${String(error)}`))
          .finally(() => setPending(false))
      }

      const label = h(
        'span',
        { style: { display: 'flex', flexDirection: 'column', gap: 1, flex: '1 1 auto', minWidth: 0 } },
        h('span', null, rowLabel()),
        // The numbers sit under the label so the row still matches the height of
        // the host's own rows when the sidecar is unavailable.
        h(
          'span',
          {
            style: {
              fontSize: 11,
              lineHeight: '14px',
              color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          },
          summaryLine(stats),
        ),
      )

      return h(
        'div',
        {
          role: 'menuitemcheckbox',
          'aria-checked': on,
          tabIndex: 0,
          onMouseDown: () => postBeacon('row-down'),
          onClick: toggle,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          onKeyDown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggle()
            }
          },
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            boxSizing: 'border-box',
            minWidth: '100%',
            minHeight: 34,
            padding: '0 8px',
            margin: 0,
            fontSize: 13,
            lineHeight: '20px',
            cursor: ready ? 'pointer' : 'default',
            opacity: ready ? 1 : 0.55,
            userSelect: 'none',
            borderRadius: 'var(--dsw-radius-md)',
            background: hover ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
          },
        },
        label,
        h(
          'span',
          {
            'aria-hidden': true,
            style: {
              position: 'relative',
              display: 'inline-block',
              flex: '0 0 auto',
              width: 30,
              height: 18,
              borderRadius: 9,
              background: on ? '#3b82f6' : 'rgba(128,128,128,0.45)',
              transition: 'background 120ms ease',
            },
          },
          h('span', {
            style: {
              position: 'absolute',
              top: 2,
              left: on ? 14 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 120ms ease',
            },
          }),
        ),
      )
    }

    // ---- the plugin page panel -------------------------------------------

    function StatRow(label, value) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13 } },
        h('span', { style: { color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))' } }, label),
        h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, value),
      )
    }

    function CostPanel(ctx, props) {
      const totals = useStats('/totals', 5000)
      const health = useStats('/health', 15000)
      if (props?.view === 'summary') {
        const count = Number(totals?.count) || 0
        return h(
          'div',
          { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))' } },
          count === 0
            ? (isEnglish() ? 'No auto run yet' : '还没有自动触发过')
            : `${count} ${isEnglish() ? (count === 1 ? 'run' : 'runs') : '次'} · ${money(totals)} · ${duration(totals.ms)}`,
        )
      }
      const count = Number(totals?.count) || 0
      const conversations = Number(totals?.conversations) || 0
      const peak = totals?.peak === true
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0', minWidth: 260 } },
        StatRow(isEnglish() ? 'Auto runs' : '自动触发次数', String(count)),
        totals?.status !== undefined && totals.status !== null
          ? StatRow(isEnglish() ? 'State' : '状态', totals.status.tripped === true
            ? (isEnglish() ? 'Stopped after repeated failures' : '连续失败，已停止')
            : (totals.status.auto === true ? (isEnglish() ? 'Active' : '自动中') : (isEnglish() ? 'Off (manual)' : '已停止（手动）')))
          : null,
        StatRow(isEnglish() ? 'Judging time' : '判断累计用时', duration(totals?.ms)),
        StatRow(isEnglish() ? 'Cost' : '累计花费', money(totals)),
        StatRow(isEnglish() ? 'Conversations' : '涉及对话', String(conversations)),
        StatRow(isEnglish() ? 'Status' : '状态', health?.compatible === false
          ? (isEnglish() ? 'Not working — update the plugin or DSH' : '暂时用不了 —— 请更新插件或 DSH')
          : (isEnglish() ? 'Working' : '正常工作')),
        StatRow(isEnglish() ? 'Price window' : '当前价格时段', peak
          ? (isEnglish() ? 'Peak' : '高峰')
          : (isEnglish() ? 'Off-peak' : '空闲')),
        h(
          'div',
          { style: { fontSize: 11, lineHeight: '15px', marginTop: 4, color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))' } },
          isEnglish()
            ? 'Counted since DSH started. The card update runs in the background and is included in the cost.'
            : '从 DSH 启动起累计。便签更新在后台运行，其费用也计入其中。',
        ),
      )
    }

    // ---- the paused banner ------------------------------------------------

    // Sessions whose banner the user closed by hand. A conversation that goes
    // back to automatic clears its entry, so a later trip shows the banner again.
    const dismissedBanners = new Set()

    /**
     * What actually went wrong, in the user's words. A count tells nobody
     * anything, so the banner names the cause the host reported last.
     */
    const BANNER_TEXT = {
      thinking: ['自动选择推理等级已暂停：这个对话出错了。', 'Auto-select effort is paused: this conversation hit an error.'],
      timeout: ['自动选择已暂停：3 秒内没等到结果。', 'Auto-select is paused: no answer within 3 seconds.'],
      busy: ['自动选择已暂停：服务太忙，被限流了。', 'Auto-select is paused: the service is rate-limiting requests.'],
      server: ['自动选择已暂停：服务端临时出错。', 'Auto-select is paused: the service returned an error.'],
      network: ['自动选择已暂停：网络连不上。', 'Auto-select is paused: the network is unreachable.'],
      noAnswer: ['自动选择已暂停：模型没按要求回答，缺 off/low/high/max。', 'Auto-select is paused: the reply did not name off/low/high/max.'],
      notAllowed: ['自动选择已暂停：选出的等级不在你允许的范围里。', 'Auto-select is paused: the answer was a level you turned off.'],
      unsupported: ['自动选择已暂停：当前模型不支持这个等级。', 'Auto-select is paused: this model does not support that level.'],
      hostDown: ['自动选择已暂停：插件拿不到模型服务。', 'Auto-select is paused: the model service was unavailable.'],
      unknown: ['自动选择已暂停：出错了。', 'Auto-select is paused: it hit an error.'],
      failures: ['自动选择已暂停：连续失败。', 'Auto-select is paused after repeated failures.'],
    }

    /** The line the banner shows for one status snapshot. */
    function bannerText(status) {
      const cause = status?.cause === 'thinking' ? 'thinking' : (status?.failCause ?? 'failures')
      const pair = BANNER_TEXT[cause] ?? BANNER_TEXT.unknown
      return isEnglish() ? pair[1] : pair[0]
    }

    const bannerButton = {
      appearance: 'none',
      border: '1px solid rgba(245,158,11,0.55)',
      background: 'rgba(245,158,11,0.16)',
      color: 'inherit',
      font: 'inherit',
      fontSize: 12,
      lineHeight: '18px',
      padding: '1px 8px',
      borderRadius: 999,
      cursor: 'pointer',
      flex: '0 0 auto',
    }

    const bannerClose = {
      appearance: 'none',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: 15,
      lineHeight: '18px',
      padding: '0 2px',
      cursor: 'pointer',
      opacity: 0.7,
      flex: '0 0 auto',
    }

    /**
     * A full-width row above the input box, shown only when automatic selection
     * stopped on its own (repeated failures), never when the user turned it off.
     * It stays until the user acts on it: reopen, or dismiss for this conversation.
     */
    function PausedBanner(ctx, props) {
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const stats = useStats(sessionId ? `/stats?session=${encodeURIComponent(sessionId)}` : '', 2000)
      const [dismissed, setDismissed] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const tripped = stats?.status?.tripped === true
      const text = bannerText(stats?.status)

      React.useEffect(() => {
        // Only a real answer can clear the dismissal: an empty first render (no
        // stats yet) must not bring back a bar the user already closed.
        if (stats !== null && !tripped) dismissedBanners.delete(sessionId)
      }, [stats, tripped, sessionId])

      if (!tripped || sessionId === '' || dismissed || dismissedBanners.has(sessionId)) return null

      const resume = () => {
        if (busy) return
        setBusy(true)
        postSwitch(sessionId, true)
          .then(result => {
            const applied = result?.status
            // Only hide the bar once the host confirms it is back on; a failed
            // click must leave the reason on screen.
            if (applied?.auto === true || applied?.tripped === false) {
              dismissedBanners.delete(sessionId)
              setDismissed(true)
            } else {
              ctx.logger?.warn?.('cannot switch mode: the host did not confirm')
            }
          })
          .catch(error => ctx.logger?.warn?.(`cannot switch mode: ${String(error)}`))
          .finally(() => setBusy(false))
      }

      const shut = () => {
        dismissedBanners.add(sessionId)
        setDismissed(true)
      }

      return h(
        'div',
        {
          role: 'status',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 0 6px',
            padding: '6px 10px',
            fontSize: 12,
            lineHeight: '18px',
            borderRadius: 'var(--dsw-radius-md, 8px)',
            border: '1px solid rgba(245,158,11,0.45)',
            background: 'rgba(245,158,11,0.10)',
          },
        },
        h(
          'span',
          { style: { flex: '1 1 auto' } },
          text,
        ),
        h('button', { type: 'button', onClick: resume, style: bannerButton }, isEnglish() ? 'Turn it back on' : '重新打开'),
        h(
          'button',
          {
            type: 'button',
            onClick: shut,
            title: isEnglish() ? 'Dismiss' : '关闭提示',
            'aria-label': isEnglish() ? 'Dismiss' : '关闭提示',
            style: bannerClose,
          },
          '×',
        ),
      )
    }

    // ---- level-pick watcher ---------------------------------------------

    // Text of the four effort rows, as the host renders them. A pick of the row
    // that is already checked returns inside the menu component before it asks
    // the host (`ModelSelect.tsx` chooseEffort), so the host never learns about
    // it; watching the click is the only way to honour "any hand-picked level
    // turns auto off, including the one it already set".
    const LEVEL_LABELS = new Set(['关闭思考', 'turns reasoning off', 'off', 'low', 'high', 'max'])

    function watchLevelPicks(ctx) {
      const listener = event => {
        const target = event.target
        if (!(target instanceof Element)) return
        // Any effort row turns auto off, including the row that is already
        // checked: the host's menu returns before it tells anyone about a pick
        // that changes nothing, so only the click can be seen here.
        const row = target.closest('[role="menuitemradio"]')
        if (row === null) return
        const label = (row.textContent ?? '').trim().toLowerCase()
        // The host renders these rows with a word and sometimes a hint next to
        // it ("low · 低"), so match the leading word rather than the whole text.
        if (!LEVEL_LABELS.has(label) && !/^(off|low|high|max)\b/.test(label) && !label.includes('关闭思考')) return
        if (lastSessionId === '') return
        postBeacon('level-click')
        // A hand-picked level always turns automatic selection off, and only for
        // the conversation whose menu this is.
        postSwitch(lastSessionId, false).catch(error => {
          ctx.logger?.warn?.(`auto-effort: cannot switch off after a level pick: ${String(error)}`)
        })
      }
      document.addEventListener('click', listener, true)
      return () => { document.removeEventListener('click', listener, true) }
    }

    return {
      inject: ['slots', 'configForms'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.model.options', () =>
          ctx.slots.register(
            { name: 'conversation.input.model.options', id: 'auto-effort-auto', order: 20 },
            props => AutoRow(ctx, props),
          ),
        )
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            { name: 'conversation.input.dock', id: 'auto-effort-paused', order: 5 },
            props => PausedBanner(ctx, props),
          ),
        )
        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register(
            { name: 'plugins.bundle.config', key: BUNDLE },
            props => CostPanel(ctx, props),
          ),
        )
        if (typeof ctx.effect === 'function') ctx.effect(() => watchLevelPicks(ctx), 'auto-effort: level pick watcher')
        else watchLevelPicks(ctx)
      },
    }
  },
})
