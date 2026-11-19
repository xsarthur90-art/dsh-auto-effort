/**
 * Configuration schema for the plugin page and the composer switch.
 *
 * DSH only exposes a settings namespace for an entry that declares a `Config`
 * schema, and the browser half writes it through `ctx.configForms.get(entryId)`.
 * The host half validates the same fields again in `config.js`, so this schema
 * is the UI-facing description, not the enforcement point.
 */
import z from '@deepseek-ai/schemastery'

/** Four efforts the DeepSeek adapter publishes. */
const LEVEL = z.union([z.const('off'), z.const('low'), z.const('high'), z.const('max')])

export const Config = z.object({
  enabled: z.boolean().default(true).description('开启插件。关闭后插件完全不介入。'),
  mode: z
    .union([z.const('manual'), z.const('auto')])
    .default('auto')
    .volatile()
    .description('新对话的默认值：manual 不自动选择，auto 每条消息自动判断。模型菜单里的开关只影响当前这个对话。'),
  levels: z
    .array(LEVEL)
    .default(['off', 'low', 'high', 'max'])
    .description('允许自动选择的推理等级集合。'),
  judgeModel: z
    .string()
    .default('deepseek-flash')
    .description('判断用的模型；留空或写 model 表示沿用当前对话的模型。'),
  timeoutMs: z
    .number()
    .default(3000)
    .description('判断的超时时间（毫秒）；超时就沿用当前等级。'),
  cardInputChars: z
    .number()
    .default(600)
    .description('更新便签时读取回答的字数上限；调小更省钱，但准确率可能降低。'),
  cardMaxChars: z
    .number()
    .default(120)
    .description('便签自身的字数上限；调小更省钱，但准确率可能降低。'),
  defaultLevel: z
    .union([z.const(null), LEVEL])
    .default(null)
    .description('判断失败时使用的推理等级；null 表示保持你手动选的推理等级。'),
  logFile: z.string().default(null).description('调试日志路径；留空用默认位置。'),
  requireMaxForUpgrade: z
    .boolean()
    .default(false)
    .description('关闭时自动可以选到 max；打开后自动最高只到 high，max 只由你手动选。'),
  debug: z.boolean().default(false).description('把每条判断写入日志文件，便于排查。'),
})
