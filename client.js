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

    // ---- wording ----------------------------------------------------------
    //
    // Every string the plugin puts on screen, in the eight languages the host
    // itself ships. The host's `locale` service is the source of truth: it is
    // read once when the plugin applies and again whenever the user switches
    // language, so the menu and the plugin page follow the interface language.
    // Product terms below match the host's own dictionaries; do not retranslate
    // "Effort", "Settings", "General", "Plugins", "Installed plugins",
    // "Uninstall", "Model", "Steer" or "Queue" on your own.

    const LANGS = ['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']

    const S = {
      en: {
        rowLabel: 'Auto-select effort',
        stoppedFailures: 'Stopped after repeated failures — toggle the switch to retry',
        stoppedThis: 'Stopped for this conversation',
        noRun: 'No auto run yet',
        runOne: 'run',
        runMany: 'runs',
        autoRuns: 'Auto runs',
        state: 'State',
        active: 'Active',
        offManual: 'Off (manual)',
        judgeTime: 'Judging time',
        cost: 'Cost',
        conversations: 'Conversations',
        status: 'Status',
        working: 'Working',
        notWorking: 'Not working — update the plugin or DSH',
        priceWindow: 'Price window',
        peak: 'Peak',
        offPeak: 'Off-peak',
        countedNote: 'Counted since DSH started.',
        resume: 'Turn it back on',
        dismiss: 'Dismiss',
        seconds: ' s',
        bannerThinking: 'Auto-select effort is paused: this conversation hit an error.',
        bannerTimeout: 'Auto-select is paused: no answer within 3 seconds.',
        bannerBusy: 'Auto-select is paused: the service is rate-limiting requests.',
        bannerServer: 'Auto-select is paused: the service returned an error.',
        bannerNetwork: 'Auto-select is paused: the network is unreachable.',
        bannerNoAnswer: 'Auto-select is paused: the reply did not name off/low/high/max.',
        bannerNotAllowed: 'Auto-select is paused: the answer was a level you turned off.',
        bannerUnsupported: 'Auto-select is paused: this model does not support that level.',
        bannerHostDown: 'Auto-select is paused: the model service was unavailable.',
        bannerUnknown: 'Auto-select is paused: it hit an error.',
        bannerFailures: 'Auto-select is paused after repeated failures.',
      },
      zh: {
        rowLabel: '自动选择推理等级',
        stoppedFailures: '连续失败，已停止 —— 关一下开关再打开可恢复',
        stoppedThis: '本对话已停止',
        noRun: '还没有自动触发',
        runOne: '次',
        runMany: '次',
        autoRuns: '自动触发次数',
        state: '状态',
        active: '自动中',
        offManual: '已停止（手动）',
        judgeTime: '判断累计用时',
        cost: '累计花费',
        conversations: '涉及对话',
        status: '状态',
        working: '正常工作',
        notWorking: '暂时用不了 —— 请更新插件或 DSH',
        priceWindow: '当前价格时段',
        peak: '高峰',
        offPeak: '空闲',
        countedNote: '从 DSH 启动起累计。',
        resume: '重新打开',
        dismiss: '关闭提示',
        seconds: ' 秒',
        bannerThinking: '自动选择推理等级已暂停：这个对话出错了。',
        bannerTimeout: '自动选择已暂停：3 秒内没等到结果。',
        bannerBusy: '自动选择已暂停：服务太忙，被限流了。',
        bannerServer: '自动选择已暂停：服务端临时出错。',
        bannerNetwork: '自动选择已暂停：网络连不上。',
        bannerNoAnswer: '自动选择已暂停：模型没按要求回答，缺 off/low/high/max。',
        bannerNotAllowed: '自动选择已暂停：选出的等级不在你允许的范围里。',
        bannerUnsupported: '自动选择已暂停：当前模型不支持这个等级。',
        bannerHostDown: '自动选择已暂停：插件拿不到模型服务。',
        bannerUnknown: '自动选择已暂停：出错了。',
        bannerFailures: '自动选择已暂停：连续失败。',
      },
      ja: {
        rowLabel: '強度の自動選択',
        stoppedFailures: '繰り返し失敗したため停止しました — スイッチを切り替えて再試行してください',
        stoppedThis: 'この会話では停止しました',
        noRun: '自動選択はまだ実行されていません',
        runOne: '回',
        runMany: '回',
        autoRuns: '自動実行回数',
        state: '状態',
        active: '有効',
        offManual: '停止（手動）',
        judgeTime: '判定の累計時間',
        cost: '累計コスト',
        conversations: '対象の会話',
        status: 'ステータス',
        working: '正常に動作中',
        notWorking: '動作していません — プラグインまたは DSH を更新してください',
        priceWindow: '現在の料金時間帯',
        peak: 'ピーク',
        offPeak: 'オフピーク',
        countedNote: 'これまでの合計です（DSH の起動から集計）。',
        resume: 'もう一度オンにする',
        dismiss: '閉じる',
        seconds: ' 秒',
        bannerThinking: '強度の自動選択を一時停止しました：この会話でエラーが発生しました。',
        bannerTimeout: '自動選択を一時停止しました：3 秒以内に結果が返りませんでした。',
        bannerBusy: '自動選択を一時停止しました：サービスが混み合っており、レート制限中です。',
        bannerServer: '自動選択を一時停止しました：サーバー側で一時的なエラーが発生しました。',
        bannerNetwork: '自動選択を一時停止しました：ネットワークに接続できません。',
        bannerNoAnswer: '自動選択を一時停止しました：回答に off/low/high/max が含まれていません。',
        bannerNotAllowed: '自動選択を一時停止しました：選ばれた強度は許可されていません。',
        bannerUnsupported: '自動選択を一時停止しました：このモデルはその強度に対応していません。',
        bannerHostDown: '自動選択を一時停止しました：モデルサービスを取得できません。',
        bannerUnknown: '自動選択を一時停止しました：エラーが発生しました。',
        bannerFailures: '自動選択を一時停止しました：連続で失敗しました。',
      },
      es: {
        rowLabel: 'Esfuerzo automático',
        stoppedFailures: 'Detenido tras varios fallos — cambia el interruptor para reintentar',
        stoppedThis: 'Detenido en esta conversación',
        noRun: 'Todavía no se ha activado',
        runOne: 'ejecución',
        runMany: 'ejecuciones',
        autoRuns: 'Ejecuciones automáticas',
        state: 'Estado',
        active: 'Activo',
        offManual: 'Desactivado (manual)',
        judgeTime: 'Tiempo de selección',
        cost: 'Coste',
        conversations: 'Conversaciones',
        status: 'Estado',
        working: 'Funcionando',
        notWorking: 'No funciona — actualiza el complemento o DSH',
        priceWindow: 'Franja de precio',
        peak: 'Punta',
        offPeak: 'Valle',
        countedNote: 'Contado desde que arrancó DSH.',
        resume: 'Volver a activarlo',
        dismiss: 'Descartar',
        seconds: ' s',
        bannerThinking: 'Esfuerzo automático en pausa: esta conversación dio un error.',
        bannerTimeout: 'Selección en pausa: sin respuesta en 3 segundos.',
        bannerBusy: 'Selección en pausa: el servicio está limitando las peticiones.',
        bannerServer: 'Selección en pausa: el servicio devolvió un error.',
        bannerNetwork: 'Selección en pausa: no se puede acceder a la red.',
        bannerNoAnswer: 'Selección en pausa: la respuesta no indicaba off/low/high/max.',
        bannerNotAllowed: 'Selección en pausa: la respuesta era un nivel que desactivaste.',
        bannerUnsupported: 'Selección en pausa: este modelo no admite ese nivel.',
        bannerHostDown: 'Selección en pausa: el servicio del modelo no estaba disponible.',
        bannerUnknown: 'Selección en pausa: se produjo un error.',
        bannerFailures: 'Selección en pausa tras varios fallos.',
      },
      fr: {
        rowLabel: 'Effort automatique',
        stoppedFailures: "Arrêté après plusieurs échecs — basculez l'interrupteur pour réessayer",
        stoppedThis: 'Arrêté dans cette conversation',
        noRun: "Pas encore d'appel automatique",
        runOne: 'appel',
        runMany: 'appels',
        autoRuns: 'Appels automatiques',
        state: 'État',
        active: 'Actif',
        offManual: 'Désactivé (manuel)',
        judgeTime: "Temps d'évaluation",
        cost: 'Coût',
        conversations: 'Conversations',
        status: 'Statut',
        working: 'Fonctionne',
        notWorking: 'Ne fonctionne pas — mettez à jour le plugin ou DSH',
        priceWindow: 'Plage tarifaire',
        peak: 'Pointe',
        offPeak: 'Creux',
        countedNote: 'Compté depuis le démarrage de DSH.',
        resume: 'Réactiver',
        dismiss: 'Fermer',
        seconds: ' s',
        bannerThinking: 'Effort automatique en pause : cette conversation a rencontré une erreur.',
        bannerTimeout: 'Sélection en pause : aucune réponse en 3 secondes.',
        bannerBusy: 'Sélection en pause : le service limite les requêtes.',
        bannerServer: 'Sélection en pause : le service a renvoyé une erreur.',
        bannerNetwork: 'Sélection en pause : le réseau est inaccessible.',
        bannerNoAnswer: 'Sélection en pause : la réponse ne nommait pas off/low/high/max.',
        bannerNotAllowed: "Sélection en pause : la réponse correspondait à un niveau que vous avez désactivé.",
        bannerUnsupported: 'Sélection en pause : ce modèle ne prend pas en charge ce niveau.',
        bannerHostDown: 'Sélection en pause : le service du modèle était indisponible.',
        bannerUnknown: 'Sélection en pause : une erreur est survenue.',
        bannerFailures: 'Sélection en pause après plusieurs échecs.',
      },
      de: {
        rowLabel: 'Aufwand automatisch wählen',
        stoppedFailures: 'Nach wiederholten Fehlern gestoppt — Schalter umlegen, um es erneut zu versuchen',
        stoppedThis: 'Für diese Unterhaltung gestoppt',
        noRun: 'Noch kein automatischer Lauf',
        runOne: 'Lauf',
        runMany: 'Läufe',
        autoRuns: 'Automatische Läufe',
        state: 'Status',
        active: 'Aktiv',
        offManual: 'Aus (manuell)',
        judgeTime: 'Bewertungszeit',
        cost: 'Kosten',
        conversations: 'Unterhaltungen',
        status: 'Zustand',
        working: 'Funktioniert',
        notWorking: 'Funktioniert nicht — Plugin oder DSH aktualisieren',
        priceWindow: 'Preiszeitfenster',
        peak: 'Spitze',
        offPeak: 'Nebenzeit',
        countedNote: 'Seit dem Start von DSH gezählt.',
        resume: 'Wieder einschalten',
        dismiss: 'Schließen',
        seconds: ' s',
        bannerThinking: 'Automatischer Aufwand pausiert: In dieser Unterhaltung ist ein Fehler aufgetreten.',
        bannerTimeout: 'Automatische Auswahl pausiert: keine Antwort innerhalb von 3 Sekunden.',
        bannerBusy: 'Automatische Auswahl pausiert: Der Dienst begrenzt Anfragen.',
        bannerServer: 'Automatische Auswahl pausiert: Der Dienst hat einen Fehler zurückgegeben.',
        bannerNetwork: 'Automatische Auswahl pausiert: Das Netzwerk ist nicht erreichbar.',
        bannerNoAnswer: 'Automatische Auswahl pausiert: Die Antwort nannte kein off/low/high/max.',
        bannerNotAllowed: 'Automatische Auswahl pausiert: Die Antwort war eine Stufe, die Sie deaktiviert haben.',
        bannerUnsupported: 'Automatische Auswahl pausiert: Dieses Modell unterstützt diese Stufe nicht.',
        bannerHostDown: 'Automatische Auswahl pausiert: Der Modelldienst war nicht verfügbar.',
        bannerUnknown: 'Automatische Auswahl pausiert: Es ist ein Fehler aufgetreten.',
        bannerFailures: 'Automatische Auswahl nach wiederholten Fehlern pausiert.',
      },
      ru: {
        rowLabel: 'Автоматическое усилие',
        stoppedFailures: 'Остановлено после повторных ошибок — переключите тумблер, чтобы повторить',
        stoppedThis: 'Остановлено в этой беседе',
        noRun: 'Автоматических запусков пока не было',
        runOne: 'запуск',
        runMany: 'запусков',
        autoRuns: 'Автоматические запуски',
        state: 'Состояние',
        active: 'Активно',
        offManual: 'Выключено (вручную)',
        judgeTime: 'Время выбора',
        cost: 'Стоимость',
        conversations: 'Беседы',
        status: 'Статус',
        working: 'Работает',
        notWorking: 'Не работает — обновите плагин или DSH',
        priceWindow: 'Ценовой период',
        peak: 'Пиковый',
        offPeak: 'Ночной',
        countedNote: 'Считается с момента запуска DSH.',
        resume: 'Включить снова',
        dismiss: 'Закрыть',
        seconds: ' с',
        bannerThinking: 'Автоматическое усилие приостановлено: в этой беседе произошла ошибка.',
        bannerTimeout: 'Автоматический выбор приостановлен: ответа нет в течение 3 секунд.',
        bannerBusy: 'Автоматический выбор приостановлен: сервис ограничивает запросы.',
        bannerServer: 'Автоматический выбор приостановлен: сервис вернул ошибку.',
        bannerNetwork: 'Автоматический выбор приостановлен: сеть недоступна.',
        bannerNoAnswer: 'Автоматический выбор приостановлен: в ответе не было off/low/high/max.',
        bannerNotAllowed: 'Автоматический выбор приостановлен: ответ — уровень, который вы отключили.',
        bannerUnsupported: 'Автоматический выбор приостановлен: эта модель не поддерживает такой уровень.',
        bannerHostDown: 'Автоматический выбор приостановлен: сервис модели был недоступен.',
        bannerUnknown: 'Автоматический выбор приостановлен: произошла ошибка.',
        bannerFailures: 'Автоматический выбор приостановлен после повторных ошибок.',
      },
      pt: {
        rowLabel: 'Esforço automático',
        stoppedFailures: 'Parado após várias falhas — alterne o interruptor para tentar de novo',
        stoppedThis: 'Parado nesta conversa',
        noRun: 'Ainda não houve execução automática',
        runOne: 'execução',
        runMany: 'execuções',
        autoRuns: 'Execuções automáticas',
        state: 'Estado',
        active: 'Ativo',
        offManual: 'Desligado (manual)',
        judgeTime: 'Tempo de seleção',
        cost: 'Custo',
        conversations: 'Conversas',
        status: 'Status',
        working: 'Funcionando',
        notWorking: 'Não está funcionando — atualize o plug-in ou o DSH',
        priceWindow: 'Faixa de preço',
        peak: 'Pico',
        offPeak: 'Fora de pico',
        countedNote: 'Contado desde que o DSH iniciou.',
        resume: 'Ligar de novo',
        dismiss: 'Fechar',
        seconds: ' s',
        bannerThinking: 'Esforço automático pausado: esta conversa deu erro.',
        bannerTimeout: 'Seleção pausada: sem resposta em 3 segundos.',
        bannerBusy: 'Seleção pausada: o serviço está limitando as requisições.',
        bannerServer: 'Seleção pausada: o serviço retornou um erro.',
        bannerNetwork: 'Seleção pausada: a rede está inacessível.',
        bannerNoAnswer: 'Seleção pausada: a resposta não trazia off/low/high/max.',
        bannerNotAllowed: 'Seleção pausada: a resposta era um nível que você desativou.',
        bannerUnsupported: 'Seleção pausada: este modelo não suporta esse nível.',
        bannerHostDown: 'Seleção pausada: o serviço do modelo estava indisponível.',
        bannerUnknown: 'Seleção pausada: ocorreu um erro.',
        bannerFailures: 'Seleção pausada após várias falhas.',
      },
    }

    /** The interface language in use right now. */
    let activeLang = 'en'
    /** Longest-prefix match: zh-TW and zh-CN both mean zh. */
    function pickLang(raw) {
      const value = String(raw ?? '').toLowerCase()
      return LANGS.find(code => value === code || value.startsWith(code + '-')) ?? 'en'
    }
    function guessLang() {
      const fromDocument = document?.documentElement?.lang
      if (typeof fromDocument === 'string' && fromDocument !== '') return pickLang(fromDocument)
      const fromNavigator = navigator?.language
      if (typeof fromNavigator === 'string' && fromNavigator !== '') return pickLang(fromNavigator)
      return 'en'
    }
    function lang() {
      return activeLang
    }
    function t(key) {
      const dict = S[activeLang] ?? S.en
      return dict[key] ?? S.en[key] ?? key
    }
    function rowLabel() {
      return t('rowLabel')
    }

    /** Every mounted piece of UI re-renders when the interface language changes. */
    const langListeners = new Set()
    function notifyLang() {
      for (const fn of langListeners) {
        try {
          fn()
        } catch {
          // One broken listener must not stop the others.
        }
      }
    }
    function useLang() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const fn = () => bump(value => value + 1)
        langListeners.add(fn)
        return () => {
          langListeners.delete(fn)
        }
      }, [])
      return activeLang
    }
    /**
     * Follow the host's `locale` service: it knows which language the interface
     * is in, and it tells us when the user switches. Without it (an older host)
     * the page's own language is the best guess.
     */
    function followLang(ctx) {
      const svc = ctx.get?.('locale')
      const read = () => {
        try {
          const next = pickLang(svc?.getSnapshot?.()?.active ?? guessLang())
          if (next !== activeLang) {
            activeLang = next
            notifyLang()
          }
        } catch {
          // Keep whatever we have.
        }
      }
      read()
      if (typeof svc?.subscribe === 'function') return svc.subscribe(read)
      return undefined
    }

    // ---- the cost sidecar -------------------------------------------------

    let basePromise = null

    /** A port that accepted the connection but never answers would hang everything. */
    const PROBE_TIMEOUT_MS = 1500
    const READ_TIMEOUT_MS = 2000
    const WRITE_TIMEOUT_MS = 3000

    function forgetBase() { basePromise = null }

    /** Older kernels have no AbortSignal.timeout: fall back to no deadline. */
    function deadline(ms) {
      try {
        return typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(ms) : undefined
      } catch {
        return undefined
      }
    }

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
          const response = await fetch(`http://127.0.0.1:${port}/health`, {
            cache: 'no-store',
            signal: deadline(PROBE_TIMEOUT_MS),
          })
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
        const response = await fetch(`${base}${path}`, {
          cache: 'no-store',
          signal: deadline(READ_TIMEOUT_MS),
        })
        return response.ok ? await response.json() : null
      } catch {
        // The remembered port stopped answering: the sidecar probably moved.
        // Probe again on the next tick instead of waiting for a page reload.
        forgetBase()
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
          signal: deadline(WRITE_TIMEOUT_MS),
        })
        return response.ok ? await response.json() : null
      } catch {
        forgetBase()
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
      // The Chinese interface shows DeepSeek's CNY price list; every other one
      // shows the USD list. Never convert between them.
      const cny = lang() === 'zh'
      const value = Number(cny ? stats?.cny : stats?.usd) || 0
      const symbol = cny ? '¥' : '$'
      return value >= 0.01 ? `${symbol}${value.toFixed(2)}` : `${symbol}${value.toFixed(4)}`
    }

    function duration(ms) {
      const seconds = (Number(ms) || 0) / 1000
      if (seconds >= 10) return `${seconds.toFixed(0)}${t('seconds')}`
      return `${seconds.toFixed(1)}${t('seconds')}`
    }

    function summaryLine(stats) {
      // A conversation can stop for a reason the user must see, not just a
      // count: the breaker latched after an API error, or the switch was turned
      // off by a manual pick. Say so instead of showing a stale number — but keep
      // the numbers this conversation already spent.
      const count = Number(stats?.count) || 0
      if (stats?.status?.tripped === true) return t('stoppedFailures')
      if (stats?.status?.auto === false) return t('stoppedThis')
      if (count === 0) return t('noRun')
      return `${count} ${t(count === 1 ? 'runOne' : 'runMany')} · ${money(stats)} · ${duration(stats.ms)}`
    }

    /** Poll one endpoint while mounted; the menu is short-lived, so 2 s is enough. */
    function useStats(path, intervalMs = 2000) {
      const [stats, setStats] = React.useState(null)
      React.useEffect(() => {
        if (!path) return undefined
        let alive = true
        let inFlight = false
        // A new conversation must not be shown the previous one's numbers, even
        // for the second before the first answer arrives.
        setStats(null)
        const tick = async () => {
          // A hung request must not stack another one behind it every 2 s.
          if (inFlight) return
          inFlight = true
          try {
            const next = await readStats(path)
            if (alive && next !== null) setStats(next)
          } finally {
            inFlight = false
          }
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
      useLang()
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      // Written in an effect, not during render: a render that never commits must
      // not decide which conversation the level watcher will act on.
      React.useEffect(() => {
        if (sessionId !== '') lastSessionId = sessionId
      }, [sessionId])
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
      useLang()
      const totals = useStats('/totals', 5000)
      const health = useStats('/health', 15000)
      if (props?.view === 'summary') {
        const count = Number(totals?.count) || 0
        return h(
          'div',
          { style: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))' } },
          count === 0
            ? t('noRun')
            : `${count} ${t(count === 1 ? 'runOne' : 'runMany')} · ${money(totals)} · ${duration(totals.ms)}`,
        )
      }
      const count = Number(totals?.count) || 0
      const conversations = Number(totals?.conversations) || 0
      const peak = totals?.peak === true
      // "No answer yet" is not "zero": a panel that shows 0 runs and 0.0000 next
      // to "Working" while the sidecar is unreachable is simply lying.
      const dash = '—'
      const status = health === null
        ? dash
        : (health.compatible === false ? t('notWorking') : t('working'))
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0', minWidth: 260 } },
        StatRow(t('autoRuns'), totals === null ? dash : String(count)),
        StatRow(t('judgeTime'), totals === null ? dash : duration(totals.ms)),
        StatRow(t('cost'), totals === null ? dash : money(totals)),
        StatRow(t('conversations'), totals === null ? dash : String(conversations)),
        StatRow(t('status'), status),
        StatRow(t('priceWindow'), totals === null ? dash : (peak ? t('peak') : t('offPeak'))),
        h(
          'div',
          { style: { fontSize: 11, lineHeight: '15px', marginTop: 4, color: 'var(--dsw-alias-text-secondary, rgba(128,128,128,0.95))' } },
          t('countedNote'),
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
    const BANNER_KEYS = {
      thinking: 'bannerThinking',
      timeout: 'bannerTimeout',
      busy: 'bannerBusy',
      server: 'bannerServer',
      network: 'bannerNetwork',
      noAnswer: 'bannerNoAnswer',
      notAllowed: 'bannerNotAllowed',
      unsupported: 'bannerUnsupported',
      hostDown: 'bannerHostDown',
      unknown: 'bannerUnknown',
      failures: 'bannerFailures',
    }

    /** The line the banner shows for one status snapshot. */
    function bannerText(status) {
      const cause = status?.cause === 'thinking' ? 'thinking' : (status?.failCause ?? 'failures')
      return t(BANNER_KEYS[cause] ?? BANNER_KEYS.unknown)
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
      useLang()
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
        h('button', { type: 'button', onClick: resume, style: bannerButton }, t('resume')),
        h(
          'button',
          {
            type: 'button',
            onClick: shut,
            title: t('dismiss'),
            'aria-label': t('dismiss'),
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
      inject: ['slots', 'configForms', 'locale'],
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
        if (typeof ctx.effect === 'function') ctx.effect(() => followLang(ctx), 'auto-effort: interface language')
        else followLang(ctx)
      },
    }
  },
})
