<p align="center">
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ja.md">日本語</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.es.md">Español</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.fr.md">Français</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.de.md">Deutsch</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ru.md">Русский</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.pt.md">Português</a>
</p>

# dsh-auto-effort · 自动选择推理等级

不用再选推理等级。装一次，之后每条消息都**由 DeepSeek 替你自动选择**推理等级。

## 省钱、省时间、省心，花费可见，随时开关

![模型菜单里的「自动选择推理等级」](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/menu-zh.png)

- **省钱**：手动选推理等级，选低了要返工、更花钱，选高了白烧 token。自动选择每条消息只多花约 ¥0.0013（繁忙时段翻倍）。
- **省时间**：手动选等级要点两下、花 2–3 秒，选低了还得重来，选高了浪费推理时间。自动选择只多等约 0.7 秒。
- **省心**：不用每条消息都想「这条该 low 还是 max」，也不用懊悔「哎呀，选错了」。你只管说事，等级它来定。不烧心！
- **花费可见**：菜单那一行直接写着本对话触发了几次、花了多少、等了多久；插件页里是累计总数。
- **随时开关**：不想用就一键关掉；想用了再打开。

![插件页里的累计总数](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/plugin-page-zh.png)

## 它怎么判断的？

本插件接入最新 DeepSeek 模型，它会总结前文，在后台生成一张不超过 120 字的便签。每次你发消息，它会读你这条消息 + 便签，从四个推理等级中选一个。便签记着这轮对话在做什么、还差什么，所以「好的，开始吧」会按没做完的事来判，不会因为句子短被当成闲聊。

| 推理等级 | DeepSeek 模型判断用在 | 实测例子 |
|---|---|---|
| `off` | 闲聊、确认、查资料、改配置、跑命令 | 列一下当前目录 |
| `low` | 小改动、改名、整理、照着已有写法改代码 | 把这段代码里的变量名统一一下 |
| `high` | 分析原因、排查报错、解释原理、写较复杂的代码 | 帮我分析为什么这个方案会慢 |
| `max` | 架构方案、多方案比较、多因素权衡、疑难 bug 根因 | 帮我从日志一路排查这个偶发内存泄漏的根因 |

> DeepSeek 官方只定义了强度参数（`low` / `high` / `max`，以及 `off` 关闭思考），**并没有规定哪类任务该用哪一个推理等级**。上表是 DeepSeek 模型自己的建议，没有任何人工干预。例子都是拿真实判断跑过的。

## 开销

插件需要对每条消息进行一次判断 + 一次便签更新。判断每次只输出 off／low／high／max 四选一，几乎不耗费 token，耗时约 0.7 秒。便签最多 120 字，不会因为会话变长而增加字数。便签是回答完之后在后台写的，不占你的时间。

| 每一条消息 | 空闲时段 | 繁忙时段 |
|---|---|---|
| 判断 + 便签 | **约 ¥0.0013** | **约 ¥0.0027** |

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

以后更新时，先看一眼 [CHANGELOG.md](https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/CHANGELOG.md) 里这版改了什么，再决定什么时候重启 DSH。

## 开启与关闭

**开启**

装好即启用，新对话马上生效；**老对话重启 DSH 后生效。**

**关闭**

- 模型菜单里关掉**自动选择推理等级**：只影响当前这个对话。
- 手动选任意一个推理等级：也会关掉当前这个对话的自动选择。
- 插件页里把插件关掉：所有对话都停止自动选择。

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

## 繁忙时发消息

**设置 → 通用设置 → 繁忙时的发送行为**决定你在它还在回答时发的消息怎么处理：

- **「插话发送」**：这条消息并进正在跑的这一轮，沿用这一轮的推理等级。
- **「排队发送」**：效果和正常发送相同。

## 没生效怎么办

1. 确认插件页面（**插件 → 已安装插件**）里它是**已启用**状态。
2. 如果这个对话是在装插件之前就开着的，重启一次 DSH。
3. 确认模型菜单里的**自动选择推理等级**还是开着的——手动选过等级会让这个对话关掉自动。
4. 看日志：默认 `~/.dsh/auto-effort.log`，里面每条消息都有一行 `turn N judging …`。
5. 某一轮遇到 API 报错，或者判断连续失败 3 次，插件会暂停这个对话，并在输入框上方出现一条提示条，写清是什么原因。点提示条上的**重新打开**，或者把菜单里的开关关一下再打开，就会恢复，不用重启。

## 卸载

**插件 → 已安装插件 → dsh-auto-effort → 移除。** 自动选择停止，配置残留会被一并清掉。

## 开发

- 源码：`index.js`（主机侧）、`client.js`（模型菜单里的开关与暂停提示条）、`judge.js`（两次判断调用）、`config.js`（无依赖校验）、`schema.js`（配置 schema）、`stats.js` 与 `server.js`（菜单/插件页那几个数字与本对话开关背后的本机计数器）。
- 从本地目录装（`install_bundle <某目录>`）是开发者才用得到的方式，普通用户不会这样装；移除插件前请先备份那个目录。
- 运行 `npm test` 跑三套离线检查：配置/解析/超时，接管与本对话开关的接线（含暂停提示条读的状态），以及本机回环服务。
