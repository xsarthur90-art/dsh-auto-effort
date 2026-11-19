// Sidecar check: the switch endpoint and the numbers endpoint, over a real
// loopback socket, with a stub handler. No host, no model, no network.
import assert from 'node:assert/strict'
import { start, setSwitchHandler } from '../server.js'
import { record, setStatus } from '../stats.js'

const base = port => `http://127.0.0.1:${port}`

// A stub handler stands in for the host half's per-conversation state.
const calls = []
setSwitchHandler((sessionId, on) => {
  calls.push({ sessionId, on })
  return { auto: on, tripped: false }
})

record({ sessionId: 'session-x', kind: 'judge', ms: 700, usage: { inputTokens: 70, outputTokens: 4 } })
setStatus('session-x', { auto: true, tripped: false })

const server = await start({})
try {
  const health = await (await fetch(`${base(server.port)}/health`)).json()
  assert.equal(health.ok, true)
  assert.equal(health.name, 'dsh-auto-effort')

  // The browser preflights the JSON POST; a 405 here made every click a no-op.
  const preflight = await fetch(`${base(server.port)}/switch`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://127.0.0.1:52938',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*')
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/)

  // The switch: one conversation, on or off.
  const on = await fetch(`${base(server.port)}/switch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session: 'session-x', on: true }),
  })
  assert.equal(on.status, 200)
  const onBody = await on.json()
  assert.equal(onBody.ok, true)
  assert.deepEqual(onBody.status, { auto: true, tripped: false })
  assert.deepEqual(calls.at(-1), { sessionId: 'session-x', on: true })

  const off = await fetch(`${base(server.port)}/switch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session: 'session-x', on: false }),
  })
  assert.equal(off.status, 200)
  assert.deepEqual(calls.at(-1), { sessionId: 'session-x', on: false })

  // A missing session id is forwarded anyway: the host falls back to the
  // conversation it touched last, and refusing here froze the menu switch.
  const empty = await fetch(`${base(server.port)}/switch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(empty.status, 200)
  assert.deepEqual(calls.at(-1), { sessionId: '', on: false })
  const broken = await fetch(`${base(server.port)}/switch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  })
  assert.equal(broken.status, 400)

  // A click that never reaches the host leaves a beacon behind.
  assert.equal((await fetch(`${base(server.port)}/beacon?where=switch-click`)).status, 200)
  const trace = await (await fetch(`${base(server.port)}/switch-log`)).json()
  assert.equal(trace.attempts.at(-1).kind, 'beacon')
  assert.equal(trace.attempts.filter(entry => entry.kind === 'switch').length, 3)

  // Per-conversation numbers.
  const stats = await (await fetch(`${base(server.port)}/stats?session=session-x`)).json()
  assert.equal(stats.count, 1)
  assert.equal(stats.status.auto, true)
  assert.ok(stats.cny > 0)

  // Unknown paths and non-POST verbs.
  assert.equal((await fetch(`${base(server.port)}/nope`)).status, 404)
  assert.equal((await fetch(`${base(server.port)}/switch`, { method: 'PUT' })).status, 405)
} finally {
  setSwitchHandler(null)
  await server.close()
}

console.log('auto-effort sidecar checks: OK')
