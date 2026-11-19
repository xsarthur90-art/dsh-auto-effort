# dsh-auto-effort · 自动推理等级

Stop picking an effort. Install it once and **DeepSeek picks it for every message**.

不用再选推理等级。装一次，之后每条消息都**由 DeepSeek 替你自动选择**推理等级。

## Cheaper, faster, more relaxed — cost in sight, switch anytime

![The model menu with the Auto-select effort row](https://cdn.jsdelivr.net/npm/dsh-auto-effort@latest/docs/menu-en.png)

- **Cheaper**: picking an effort by hand usually means picking wrong — too low means rework and more spend, too high burns tokens. Auto costs only about `$0.0002` extra per message off-peak, about `$0.0004` at peak.
- **Faster**: picking by hand takes two clicks and 2–3 s; a too-low pick means redoing the work, a too-high one wastes reasoning time. Auto adds only about **0.7 s** per message.
- **More relaxed**: no more weighing "low or max" for every message, and no more "oops, wrong effort". Just say what you want; the effort follows. **No anxiety!**
- **Cost in sight**: the menu row shows this conversation's runs, cost and judging time, and the plugin page keeps a running total.
- **Switch anytime**: turn it off whenever you do not want it, on when you do.

![The plugin page, with the running totals](https://cdn.jsdelivr.net/npm/dsh-auto-effort@latest/docs/plugin-page-en.png)

## 省钱、省时间、省心，花费可见，随时开关

![模型菜单里的「自动选择推理等级」](https://cdn.jsdelivr.net/npm/dsh-auto-effort@latest/docs/menu-zh.png)

- **省钱**：手动选推理等级，选低了要返工、更花钱，选高了白烧 token。自动选择每条消息只多花约 ¥0.0013（繁忙时段翻倍）。
- **省时间**：手动选等级要点两下、花 2–3 秒，选低了还得重来，选高了浪费推理时间。自动选择只多等约 0.7 秒。
- **省心**：不用每条消息都想「这条该 low 还是 max」，也不用懊悔「哎呀，选错了」。你只管说事，等级它来定。不烧心！
- **花费可见**：菜单那一行直接写着本对话触发了几次、花了多少、等了多久；插件页里是累计总数。
- **随时开关**：不想用就一键关掉；想用了再打开。

![插件页里的累计总数](https://cdn.jsdelivr.net/npm/dsh-auto-effort@latest/docs/plugin-page-zh.png)

## How it judges

The plugin plugs into the latest DeepSeek model. It summarises the conversation and keeps a card of at most 120 characters in the background. Every time you send a message it reads that message plus the card, then picks one of the four efforts. The card records what the conversation is doing and what is left, so "ok, go ahead" is judged by the pending work rather than by its own length.

| Effort | What DeepSeek picks it for | Measured example |
|---|---|---|
| `off` | chat, confirmations, lookups, config edits, running commands | list the current directory |
| `low` | small edits, renames, tidying, applying a known pattern | rename these variables consistently |
| `high` | analysis, debugging, explaining why, non-trivial code | help me work out why this approach is slow |
| `max` | architecture, comparing options, multi-factor tradeoffs, hard bugs | trace this intermittent memory leak in the log to its root cause |

> DeepSeek documents the strength parameter (`low` / `high` / `max`, plus `off` for thinking off) but **never says which kind of task belongs to which effort**. The table above is what the DeepSeek judge suggests on its own, with no human input; every example was run against the real judge.

## 它怎么判断的？

本插件接入最新 DeepSeek 模型，它会总结前文，在后台生成一张不超过 120 字的便签。每次你发消息，它会读你这条消息 + 便签，从四个推理等级中选一个。便签记着这轮对话在做什么、还差什么，所以「好的，开始吧」会按没做完的事来判，不会因为句子短被当成闲聊。

| 推理等级 | DeepSeek 模型判断用在 | 实测例子 |
|---|---|---|
| `off` | 闲聊、确认、查资料、改配置、跑命令 | 列一下当前目录 |
| `low` | 小改动、改名、整理、照着已有写法改代码 | 把这段代码里的变量名统一一下 |
| `high` | 分析原因、排查报错、解释原理、写较复杂的代码 | 帮我分析为什么这个方案会慢 |
| `max` | 架构方案、多方案比较、多因素权衡、疑难 bug 根因 | 帮我从日志一路排查这个偶发内存泄漏的根因 |

> DeepSeek 官方只定义了强度参数（`low` / `high` / `max`，以及 `off` 关闭思考），**并没有规定哪类任务该用哪一个推理等级**。上表是 DeepSeek 模型自己的建议，没有任何人工干预。例子都是拿真实判断跑过的。

## Cost

The plugin makes one judgement and one card update per message. The judgement only ever answers one word — off, low, high or max — so it costs almost no tokens, and it takes about 0.7 s. The card is capped at 120 characters, so it never grows with the conversation. The card is written in the background after the reply and never adds to your wait.

| Per message | Off-peak | Peak |
|---|---|---|
| Judge + card | about `$0.0002` | about `$0.0004` |

## 开销

插件需要对每条消息进行一次判断 + 一次便签更新。判断每次只输出 off／low／high／max 四选一，几乎不耗费 token，耗时约 0.7 秒。便签最多 120 字，不会因为会话变长而增加字数。便签是回答完之后在后台写的，不占你的时间。

| 每一条消息 | 空闲时段 | 繁忙时段 |
|---|---|---|
| 判断 + 便签 | **约 ¥0.0013** | **约 ¥0.0027** |

## Install

Three ways, pick one.

**1. Let DSH install it** — send this in any conversation:

```
Install the plugin dsh-auto-effort
```

**2. Command line**:

```
plugin_manager install_bundle dsh-auto-effort
```

**3. Plugin page** — open **Plugins** in the sidebar, search `dsh-auto-effort`, click **Install**.

A line starting with `+ dsh-auto-effort` means it worked.

**After installing or updating the plugin, restart DSH.**

## 安装

三种办法，任选一种。

**1. 让 DSH 自己装**：在任意对话里发这句话：

```
帮我安装插件 dsh-auto-effort
```

**2. 命令行**：

```
plugin_manager install_bundle dsh-auto-effort
```

**3. 插件页搜索**：打开侧栏**插件** → 搜索 `dsh-auto-effort` → 点**安装**。

装好之后看到以 `+ dsh-auto-effort` 开头的那一行就是成功了。

**安装或更新插件后，请重启 DSH。**

## Turning it on and off

**On**

It is on the moment it is installed: a new conversation starts auto-selecting immediately, and **a conversation that was already open starts once you restart DSH.**

**Off**

- Turn off **Auto-select effort** in the model menu: this conversation only.
- Pick any effort by hand: this also turns auto off in the current conversation.
- Turn the plugin off on the plugin page: every conversation stops auto-selecting.

## 开启与关闭

**开启**

装好即启用，新对话马上生效；**老对话重启 DSH 后生效。**

**关闭**

- 模型菜单里关掉**自动选择推理等级**：只影响当前这个对话。
- 手动选任意一个推理等级：也会关掉当前这个对话的自动选择。
- 插件页里把插件关掉：所有对话都停止自动选择。

## Configuration

You normally do not edit any of this. Everything below is for tuning and troubleshooting, and the defaults suit almost everyone.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | master switch; off means no judging logic loads |
| `mode` | `auto` | the default for new conversations: `auto` judges every message, `manual` only hands off; the menu switch changes the conversation you are in |
| `levels` | `["off","low","high","max"]` | efforts auto mode may use |
| `judgeModel` | `deepseek-flash` | model used for judging; blank or `model` judges with this conversation's own model |
| `timeoutMs` | `3000` | judge timeout; on timeout the current effort is used |
| `defaultLevel` | `null` | fallback effort when judging fails; `null` means the current effort is kept |
| `requireMaxForUpgrade` | `false` | off by default, so auto can pick the top level `max`; when on, auto stops at `high` and `max` is manual only |
| `logFile` | `null` | log path; `null` means `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | how much of the reply the card writer reads; smaller is cheaper, but accuracy may drop |
| `cardMaxChars` | `120` | cap on the card text itself; smaller is cheaper, but accuracy may drop |
| `debug` | `false` | verbose logging, including the raw judge output |

## 配置

这些正常情况下一个都不用改，下面是调参和排错用的，默认值适合绝大多数人。

| 字段 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 总开关，关掉插件完全不加载判断逻辑 |
| `mode` | `auto` | 新对话的默认值：`auto` 判断每条消息，`manual` 只做手动交接；模型菜单里的开关只影响当前这个对话 |
| `levels` | `["off","low","high","max"]` | 允许自动使用的推理等级 |
| `judgeModel` | `deepseek-flash` | 判断用的模型；留空或写 `model` 就用这个对话自己的模型 |
| `timeoutMs` | `3000` | 判断超时，超时就用当前等级 |
| `defaultLevel` | `null` | 判断失败时的兜底等级；`null` 表示保持当前等级 |
| `requireMaxForUpgrade` | `false` | 默认关着：自动可以选到最高档 `max`。打开它，自动最高只到 `high`，`max` 只能你自己手动选 |
| `logFile` | `null` | 判断日志路径，`null` 用 `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | 更新便签时读取回答的字数上限；调小更省钱，但准确率可能降低 |
| `cardMaxChars` | `120` | 便签自身的字数上限；调小更省钱，但准确率可能降低 |
| `debug` | `false` | 记录详细过程（含判断的原始输出） |

## Sending while a turn is running

**Settings → General → Send behavior while busy** decides what happens to a message you send while a reply is still being written:

- **Steer** — it joins the running turn and keeps that turn's level.
- **Queue** — it behaves exactly like a normal message.

## 繁忙时发消息

**设置 → 通用设置 → 繁忙时的发送行为**决定你在它还在回答时发的消息怎么处理：

- **「插话发送」**：这条消息并进正在跑的这一轮，沿用这一轮的推理等级。
- **「排队发送」**：效果和正常发送相同。

## If nothing happens

1. Check that the plugin is **enabled** on the plugin page (**Plugins → Installed plugins**).
2. If the conversation already existed when you installed it, restart DSH once.
3. Check that **Auto-select effort** in the model menu is still on — picking an effort by hand turns it off in this conversation only.
4. Read the log at `~/.dsh/auto-effort.log` — every message writes a `turn N judging …` line.
5. If a turn hit an API error, or judging failed three times in a row, the plugin pauses this conversation and a bar above the input box tells you why. Press **Turn it back on** in that bar, or toggle the switch off and on again — no restart needed.

## 没生效怎么办

1. 确认插件页面（**插件 → 已安装插件**）里它是**已启用**状态。
2. 如果这个对话是在装插件之前就开着的，重启一次 DSH。
3. 确认模型菜单里的**自动选择推理等级**还是开着的——手动选过等级会让这个对话关掉自动。
4. 看日志：默认 `~/.dsh/auto-effort.log`，里面每条消息都有一行 `turn N judging …`。
5. 某一轮遇到 API 报错，或者判断连续失败 3 次，插件会暂停这个对话，并在输入框上方出现一条提示条，写清是什么原因。点提示条上的**重新打开**，或者把菜单里的开关关一下再打开，就会恢复，不用重启。

## Uninstall

**Plugins → Installed plugins → dsh-auto-effort → Remove.** Judging stops; the configuration it added is cleaned up.

## 卸载

**插件 → 已安装插件 → dsh-auto-effort → 移除。** 自动选择停止，配置残留会被一并清掉。

## Development

- Source: `index.js` (host half), `client.js` (the switch in the model menu and the paused banner), `judge.js` (the two judge calls), `config.js` (dependency-free validation), `schema.js` (config schema), `stats.js` and `server.js` (the local cost counter and the per-conversation switch behind the numbers).
- Installing from a local directory (`install_bundle <dir>`) is a developer path — ordinary users never install this way; back the directory up before removing the plugin.
- `npm test` runs three offline suites: config/parse/timeout, the takeover and per-conversation switch wiring (including the paused banner's status), and the loopback sidecar.

## 开发

- 源码：`index.js`（主机侧）、`client.js`（模型菜单里的开关与暂停提示条）、`judge.js`（两次判断调用）、`config.js`（无依赖校验）、`schema.js`（配置 schema）、`stats.js` 与 `server.js`（菜单/插件页那几个数字与本对话开关背后的本机计数器）。
- 从本地目录装（`install_bundle <某目录>`）是开发者才用得到的方式，普通用户不会这样装；移除插件前请先备份那个目录。
- 运行 `npm test` 跑三套离线检查：配置/解析/超时，接管与本对话开关的接线（含暂停提示条读的状态），以及本机回环服务。
