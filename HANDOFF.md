# HANDOFF — dsh-auto-effort（交接说明）

更新于 2026-11-19。读者是一个没有这段对话上下文的新 Agent。读完这份文件就能接着干。

## 一句话现状

插件 `dsh-auto-effort`（v0.2.0）在 `C:\Users\xs\Documents\deepseek-harness\default-workspace\dsh-auto-effort`，链接安装在本机 profile，**未发布**。
判定逻辑已按用户最终决定改成 **花钱版**：每条用户消息入队前调用一次 `deepseek-flash`（便签 + 这句话 → 一个词），便签在回答结束后后台更新。README 与 `docs/DETAIL*.md` 已是同一口径。
代码、README、测试三者已对齐，`npm test` 三道全绿。

## 用户与诉求

用户 xs，不写代码，产品思维强；要中文大白话、先结论后理由、讨厌术语和英文碎片。
核心诉求：每条消息自动定推理等级（`off|low|high|max`）、**同一轮生效**、口语化输入也判得准、省钱省心、花费可见、随时可关、绝不引发 API 报错。
**术语规则：任何 UI 文案一律去 DSH 的 asar 里核对，不许自己翻译。**

## 文件与职责

`C:\Users\xs\Documents\deepseek-harness\default-workspace\dsh-auto-effort\`

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主半：挂 `agent/created` → 包 `agent.followup`/`agent.steer` → 判定 → `agent.model.select()` → 再入队；熔断、能力守卫、排队扣留、状态上报、启动自检 |
| `judge.js` | 两次很小的模型调用：`judgeLevel`（判定）与 `summarizeCard`（后台更新便签） |
| `config.js` / `schema.js` | 配置校验 / schemastery 描述（`mode` 必须是 `.volatile()`，否则客户端读不到设置） |
| `state.js` | 每会话状态（WeakMap）+ `resetStates()`（每次 apply 清空，防止热重载继承熔断） |
| `stats.js` / `server.js` | 花费统计 + 127.0.0.1:53127–53131 回环小服务（`/health`、`/stats`、`/totals`、`POST /switch`） |
| `client.js` | 浏览器半：菜单行（开关 + 一行统计）、插件页面板（`plugins.bundle.config`，key 用**包名** `dsh-auto-effort`）、手动选档监听 |
| `test/auto-effort.mjs` | 配置校验 + `judgeLevel`/`summarizeCard` 的解析、超时、token 上限 |
| `test/auto-effort-wiring.mjs` | 12 个假宿主用例（顺序、跳过、封顶、开关、排队扣留、熔断） |
| `test/auto-effort-sidecar.mjs` | 真回环服务 + stub handler：`/health`、`POST /switch`、`/stats`、404、405 |

`rules.js` 与其基准 `test/rules-bench.mjs` 已删除（关键词方案被用户否决）。

工具（`..\tools\`）：`dump-session.mjs`、`timeline.mjs`、`steps-by-level.mjs`、`turn-steps.mjs`、`message-stats.mjs`、`market-scan.mjs`、`grep-asar.cjs`、`listdir.cjs`、`asar.cjs`。

## 宿主行为（已实测/读源码，别再推翻重查）

- 一轮 = 一个 API 会话。`dsh-agent-loop/src/agent.ts:294` 先 `this.model.current()`，`:302` 才 waterfall `agent/pre-step` —— pre-step 里改档只对**下一步**生效。
- 想要"这一轮就是判定值"，必须在**消息入队前**改档 → 包 `agent.followup` / `agent.steer`（`dsh-api-session-controller/src/commands.ts:374` 不 await 返回值）。
- **`agent/request` 里改 `reasoningEffort` 会被宿主抛错**（`agent.ts:641-646`：与 step preparation 时固定的值不一致即报错），`llm/stream` 拿到的又是冻结对象，改不动。故一条请求开始准备后等级就锁死。
- **轮内升档 `off → high` 会炸**：`The content[].thinking in the thinking mode must be passed back to the API.`（2026-11-18 02:10:48 实测，request_id 606a7ce5…）。`low → high` 不炸。
- 子智能体不能判：`agent.session?.header?.origin === 'subagent'` 直接跳过。
- 用户手选等级必须立刻让位（`selfSelects` 计数器区分自己与用户）。**同值选择**宿主菜单会直接关菜单、不转发（`ModelSelect.tsx` 的 `chooseEffort`），故客户端另装了捕获阶段 click 监听（`[role="menuitemradio"][aria-checked="true"]`）。
- 插件在会话创建时挂载，**热重载不会重挂已存在的会话**；重装/升级必须重启 DSH。
- 写设置会改 `C:\Users\xs\.dsh\profiles\desktop\cordis.patch.yml`；**每秒写设置会拖垮输入框**。所以菜单里点开关只写回环服务（`POST /switch`），不写配置。

## 已定决策（连同理由，别悄悄改）

1. **判定用 LLM（花钱版）**：用户最终推翻"不用 LLM"的决定——免费信号判不准口语，他接受每条约 ¥0.0013–0.0026 与约 0.7 秒等待。实测 26/27 准（27 条标注样本）。
2. **一轮内等级定死**（用户 2026-11-19 明确选 A「彻底不要」）：同轮升降会炸 thinking 回传，且 HANDOFF 里那套"可升可降"从未落地。
3. **开关是每个对话的**：菜单里点一下只影响这个对话，不写配置文件；配置里的 `mode` 只是**新对话的默认值**。
4. **排队消息扣留重判**（用户选方案 C）：设置里「插话发送」→ 消息直接进本轮、沿用本轮等级、不判；「排队发送」→ 插件扣下消息，等本轮结束后判定、作为新的一轮发出。因为等级无法在请求开始后修改，这是唯一能"重判"的做法。
5. **不做第五档 `auto`**：线缆只认 `off|low|high|max`，多一个值会让适配器抛 `UNSUPPORTED_REASONING_EFFORT`。
6. **不接管 UI**，只加一行。
7. 菜单行文案：中文「自动选择推理等级」，英文 **Auto-select effort**（DSH 菜单里写的是 `Effort`）。
8. 发布前必须问用户（原话：「以后你每次发布新版本之前，要找我确认之后再发，不要直接发」）。

## 待答/待定

- 自动被关掉时如何通知用户（用户很在意"偷偷关了我感知不到"）：候选 A 输入框下方常驻小字 `自动 · high` / `自动已关闭 · 点击恢复`；B 状态变化时一次性提示；C Windows 通知。**用户未选**。
- 临时错误 vs 永久错误的分类（网络抖动不该计入 3 次熔断；`UNSUPPORTED_REASONING_EFFORT`、thinking 报错才计）。
- 真实"各等级跑几步"的数据不足，建议插件运行时记录"判定/步数/是否失败/用户是否手改"，跑一两周再看。
- 发布：`npm pack` → `npm publish` → `remove_bundle` + `install_bundle dsh-auto-effort@<版本>` 验证外部安装路径。**未获用户批准，不要发。**
- GitHub：本地有 git 仓库和提交，**没有 remote**，等用户建仓后 push。

## 怎么验证

```powershell
cd C:\Users\xs\Documents\deepseek-harness\default-workspace\dsh-auto-effort
node --check index.js
npm test        # offline / wiring / sidecar 三道
```

改完要生效：`plugin_manager` 里 `remove_bundle dsh-auto-effort` → `install_bundle <目录绝对路径>`；已存在的会话不会重挂，**要看到效果必须重启 DSH**。

日志：`C:\Users\xs\.dsh\auto-effort.log`（UTF-8；PowerShell 5.1 用 `Get-Content -Encoding UTF8` 读，否则中文乱码）。
会话日志：`C:\Users\xs\.dsh\sessions\<工作区哈希>\<session-id>\session.v4.jsonl.zstd`（多帧 zstd，用 `tools\dump-session.mjs`）。

## 别做的事

- 别在 `agent/request` 里改 `reasoningEffort`（宿主会拒绝）。
- 别在 `agent/pre-step` 里指望改本轮等级（只影响下一步）。
- 别给 off 起手的轮次中途升档。
- 别每秒写设置；别在输入框里插 DOM（会把用户的输入搞坏）。
- 别向未声明推理能力的模型发等级（用 `ctx.llm.resolveModelInfo` 的 `reasoning.efforts` 判断，已实现）。
- 别用 PowerShell 5.1 的 `Get-Content -Raw` / `Set-Content` 改源码（按 ANSI 读写，中文会变乱码、把文件写坏）；改文件用编辑工具或 `[IO.File]::ReadAllText/WriteAllText` + UTF-8 无 BOM。
- 别在没问用户的情况下发布。
