// Wiring check: fake Cordis context, fake Agent, fake judge. No host, no network.
import assert from 'node:assert/strict'
import { apply } from '../index.js'
import { sessionStatus } from '../stats.js'

const userMessage = text => ({ content: [{ type: 'text', text }], source: { kind: 'user' } })
const tick = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * A Cordis-shaped context whose `llm` answers the judge call with `ctx.answer`
 * and whose settings document holds the default mode.
 */
function makeCtx({ mode = 'auto', efforts, answer = 'high', fail = false, failMessage = 'judge exploded' } = {}) {
  const handlers = new Map()
  const settings = { mode, revision: 1 }
  const ctx = {
    answer,
    fail,
    failMessage,
    judgeCalls: 0,
    judgePrompts: [],
    settings: {
      describe: () => [{ ns: 'auto-effort', value: { mode: settings.mode }, revision: settings.revision }],
      async update(ns, patch) {
        if (ns === 'auto-effort' && patch.mode) {
          settings.mode = patch.mode
          settings.revision += 1
        }
      },
    },
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, [])
      handlers.get(name).push(fn)
      return () => {}
    },
    logger: () => ({ info: () => {}, warn: () => {}, debug: () => {} }),
    llm: {
      async resolveModelInfo() {
        if (efforts === undefined) throw new Error('no model info')
        return { reasoning: { efforts } }
      },
      async prepareCall(config) {
        ctx.judgeCalls += 1
        return {
          config,
          async *stream(options) {
            ctx.judgePrompts.push(options.messages?.[0]?.content?.[0]?.text ?? '')
            if (ctx.fail) throw new Error(ctx.failMessage)
            yield { type: 'text-delta', text: ctx.answer }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      },
    },
    emit(name, payload) {
      for (const fn of handlers.get(name) ?? []) fn(payload, () => ({ kind: 'enter' }))
    },
  }
  return ctx
}

function makeAgent(id, origin, effort = 'high') {
  const selections = []
  const inserted = []
  let current = { provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: effort }
  const agent = {
    id,
    session: { id: `session-${id}`, origin },
    lifetimeSignal: new AbortController().signal,
    model: {
      current: () => current,
      select(selection) {
        selections.push(selection)
        current = selection
      },
    },
    followup(message) {
      inserted.push(message)
      return { handle: `handle-${id}` }
    },
    steer(message) {
      inserted.push(message)
      return { handle: `steer-${id}` }
    },
  }
  return { agent, selections, inserted }
}

// 1. The judge runs before the message is queued, and the judged level is applied.
{
  const ctx = makeCtx({ answer: 'low' })
  apply(ctx, {})
  const { agent, selections, inserted } = makeAgent('a')
  ctx.emit('agent/created', { agent })
  const message = userMessage('把这个函数改成 async 的写法')
  await agent.followup(message)
  assert.equal(ctx.judgeCalls, 1)
  assert.deepEqual(selections, [{ provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'low' }])
  assert.equal(inserted[0], message, 'the exact message object is queued')
}

// 2. Only real user turns are judged.
{
  const ctx = makeCtx({})
  apply(ctx, {})
  const { agent } = makeAgent('b')
  ctx.emit('agent/created', { agent })
  agent.followup({ content: [{ type: 'text', text: 'goal continue' }], source: { kind: 'goal' } })
  agent.followup({ content: [{ type: 'text', text: 'n' }], source: { kind: 'user', form: 'notice' } })
  assert.equal(ctx.judgeCalls, 0)
}

// 3. Subagent sessions are left completely alone.
{
  const ctx = makeCtx({})
  apply(ctx, {})
  const { agent, selections } = makeAgent('c', 'subagent')
  ctx.emit('agent/created', { agent })
  const ret = await agent.followup(userMessage('do the thing'))
  assert.equal(ret.handle, 'handle-c')
  assert.equal(ctx.judgeCalls, 0)
  assert.equal(selections.length, 0)
}

// 4. A level the model does not advertise is never selected.
{
  const ctx = makeCtx({ efforts: ['off'], answer: 'high' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('d')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('帮我分析为什么这个方案会慢'))
  assert.equal(selections.length, 0)
}

// 5. requireMaxForUpgrade caps the automatic choice at high.
{
  const ctx = makeCtx({ answer: 'max' })
  apply(ctx, { requireMaxForUpgrade: true })
  const { agent, selections } = makeAgent('e')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('设计一个跨机房的高可用方案'))
  assert.equal(selections.at(-1).reasoningEffort, 'high')

  // With the switch off (the default) max is reachable.
  const ctx2 = makeCtx({ answer: 'max' })
  apply(ctx2, {})
  const second = makeAgent('e2')
  ctx2.emit('agent/created', { agent: second.agent })
  await second.agent.followup(userMessage('设计一个跨机房的高可用方案'))
  assert.equal(second.selections.at(-1).reasoningEffort, 'max')
}

// 6. A hand-picked level turns auto off for that conversation only.
{
  const ctx = makeCtx({ answer: 'high' })
  apply(ctx, {})
  const one = makeAgent('f1')
  const two = makeAgent('f2')
  ctx.emit('agent/created', { agent: one.agent })
  ctx.emit('agent/created', { agent: two.agent })
  await one.agent.followup(userMessage('first'))
  one.agent.model.select({ provider: 'deepseek-account', model: 'deepseek-flash', reasoningEffort: 'off' })
  await one.agent.followup(userMessage('second'))
  await two.agent.followup(userMessage('third'))
  // one: 1 automatic select, then the manual pick, then nothing; two: judged again.
  assert.equal(one.selections.length, 2)
  assert.equal(two.selections.length, 1)
  assert.equal(ctx.judgeCalls, 2, 'the second conversation was judged; the manual one was not')
}

// 7. The plugin's own select is never mistaken for a manual pick.
{
  const ctx = makeCtx({ answer: 'low' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('g')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('one'))
  ctx.emit('agent/pre-step', { agent, step: 1, turn: 1 })
  ctx.emit('agent/turn-stopping', { agent, turn: 1 })
  await tick()
  await agent.followup(userMessage('two'))
  assert.equal(selections.length, 2, 'auto stays on across its own selects')
}

// 8. A step boundary never changes the level of the turn in progress.
{
  const ctx = makeCtx({ answer: 'off' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('h')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('列一下当前目录'))
  assert.equal(selections.length, 1)
  for (const step of [1, 2, 3, 4, 7, 12]) ctx.emit('agent/pre-step', { agent, step, turn: 1 })
  assert.equal(selections.length, 1, 'no step boundary ever selects')
}

// 9. "Steer" keeps the running turn's level; "queue" waits, is judged, then runs.
{
  const ctx = makeCtx({ answer: 'low' })
  apply(ctx, {})
  const { agent, selections, inserted } = makeAgent('i')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('start a long turn'))
  assert.equal(selections.length, 1)
  ctx.emit('agent/pre-step', { agent, step: 1, turn: 1 })

  await agent.steer(userMessage('and also the cache'))
  assert.equal(inserted.length, 2, 'the steer is handed over immediately')
  assert.equal(selections.length, 1, 'a steer is not judged')

  const held = await agent.followup(userMessage('queued message'))
  assert.equal(held, undefined, 'a queued message is held, not dispatched')
  assert.equal(inserted.length, 2, 'nothing reached the host yet')

  ctx.answer = 'max'
  ctx.emit('agent/turn-stopping', { agent, turn: 1 })
  await tick()
  assert.equal(inserted.length, 3, 'the held message is delivered once the turn stops')
  assert.equal(inserted.at(-1).content[0].text, 'queued message')
  assert.equal(selections.at(-1).reasoningEffort, 'max', 'it got its own, fresh judgement')
}

// 10. The thinking-error breaker latches the conversation after one failure.
{
  const ctx = makeCtx({ answer: 'high' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('j')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('first'))
  assert.equal(selections.length, 1)
  ctx.emit('agent/error', {
    agent,
    error: new Error('The `content[].thinking` in the thinking mode must be passed back to the API.'),
  })
  await agent.followup(userMessage('while tripped'))
  assert.equal(selections.length, 1, 'a tripped conversation is left alone')
}

// 11. Three judge failures in a row turn automatic selection off.
{
  const ctx = makeCtx({ fail: true })
  apply(ctx, {})
  const { agent, selections } = makeAgent('k')
  ctx.emit('agent/created', { agent })
  for (const text of ['one', 'two', 'three']) await agent.followup(userMessage(text))
  assert.equal(selections.length, 0, 'nothing is selected when the judge keeps failing')
}

// 12. A host-shutdown failure is transient: it never trips the breaker.
{
  const ctx = makeCtx({ fail: true, failMessage: 'cannot get required service "llm" in inactive context' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('m')
  ctx.emit('agent/created', { agent })
  for (const text of ['one', 'two', 'three', 'four']) await agent.followup(userMessage(text))
  ctx.fail = false
  await agent.followup(userMessage('after the reload'))
  assert.equal(selections.length, 1, 'judging resumes after a transient failure')
}

// 13. With the default mode set to manual nothing is judged.
{
  const ctx = makeCtx({ mode: 'manual', answer: 'max' })
  apply(ctx, { mode: 'manual' })
  const { agent, selections } = makeAgent('l')
  ctx.emit('agent/created', { agent })
  await agent.followup(userMessage('帮我从日志一路排查这个偶发内存泄漏的根因'))
  assert.equal(ctx.judgeCalls, 0)
  assert.equal(selections.length, 0)
}

// 14. The status keeps WHY the judge failed, so the banner can name it.
{
  const ctx = makeCtx({ fail: true, failMessage: 'judge timed out after 3000 ms' })
  apply(ctx, {})
  const { agent, selections } = makeAgent('n')
  ctx.emit('agent/created', { agent })
  for (const text of ['one', 'two', 'three']) await agent.followup(userMessage(text))
  assert.equal(selections.length, 0)
  const status = sessionStatus(agent.session.id)
  assert.equal(status.tripped, true, 'three failures trip the breaker')
  assert.equal(status.cause, 'failures')
  assert.equal(status.failCause, 'timeout', 'the banner can say what actually failed')
}
console.log('auto-effort wiring checks: OK')
