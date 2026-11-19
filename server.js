/**
 * A loopback HTTP sidecar that carries the cost numbers from the host half to
 * the browser, and the per-conversation switch from the browser back to the
 * host.
 *
 * Why a socket and not a settings field: writing this bundle's settings entry
 * on every turn (or every click) rewrites the profile patch document on disk and
 * disturbs the composer, which is unacceptable for a counter that changes on
 * every message. A localhost endpoint costs nothing per message and cannot
 * corrupt anything. It listens on 127.0.0.1 only and returns numbers — no
 * message text, no file paths, nothing private.
 */
import { createServer } from 'node:http'
import { sessionStats, sessionStatus, totalStats, isPeak } from './stats.js'

const MAX_BODY = 8 * 1024

/**
 * The browser may name a conversation `session-<id>` while the host keys it as
 * `<id>`, or the other way round. `/switch` already coped with both; reads did
 * not, so the menu silently showed nothing for half the conversations.
 * @param {string} raw
 * @returns {string}
 */
function resolveSessionId(raw) {
  if (raw === '') return raw
  if (sessionStatus(raw) !== undefined) return raw
  const alternative = raw.startsWith('session-') ? raw.slice('session-'.length) : `session-${raw}`
  return sessionStatus(alternative) !== undefined ? alternative : raw
}

function readBody(request, response, done) {
  let body = ''
  let settled = false
  const finish = text => {
    if (settled) return
    settled = true
    done(text)
  }
  request.setEncoding('utf8')
  request.on('data', chunk => {
    if (settled) return
    body += chunk
    // A request body is a few dozen bytes here; anything larger is not ours.
    if (body.length > MAX_BODY) {
      finish('')
      request.destroy()
    }
  })
  request.on('end', () => finish(body))
  request.on('error', () => finish(''))
  // An upload that is aborted fires neither `end` nor `error` on every Node
  // version; `close` is the last chance to answer the request.
  request.on('close', () => finish(''))
}

/** Problems found by the startup self-check; empty means compatible. */
let problems = []

/** Record what the startup self-check found, so the plugin page can show it. */
export function setCompatibility(next) { problems = Array.isArray(next) ? next.slice() : [] }

/**
 * The host half registers how to switch one conversation. It is the only way the
 * browser can reach the per-agent state.
 * @type {null | ((sessionId: string, on: boolean) => object | null)}
 */
let switchHandler = null

/** @param {null | ((sessionId: string, on: boolean) => object | null)} handler */
export function setSwitchHandler(handler) { switchHandler = typeof handler === 'function' ? handler : null }

/**
 * Apply the per-conversation switch without going through HTTP. The route below
 * and any host-side caller share this one path.
 * @param {string} sessionId
 * @param {boolean} on
 * @returns {object | null} the conversation's status, or null when it is unknown.
 */
export function switchNow(sessionId, on) {
  return typeof switchHandler === 'function' ? switchHandler(String(sessionId), on === true) : null
}

/**
 * The last few switch attempts, kept in memory. When the menu row looks dead,
 * this tells apart "the click never reached the host" from "the click arrived
 * but named a conversation the host does not know".
 * @type {{ at: number, session: string, on: boolean, matched: boolean }[]}
 */
const switchLog = []

/** @param {string} sessionId @param {boolean} on @param {object | null} status */
function noteSwitch(sessionId, on, status) {
  switchLog.push({ at: Date.now(), kind: 'switch', session: sessionId, on, matched: status !== null })
  if (switchLog.length > 20) switchLog.shift()
}

/** @param {string} where */
function noteBeacon(where) {
  switchLog.push({ at: Date.now(), kind: 'beacon', where })
  if (switchLog.length > 20) switchLog.shift()
}

/** Ports we try in order; the client probes the same list. */
export const PORTS = [53127, 53128, 53129, 53130, 53131]

function origin() {
  return 'http://127.0.0.1'
}

/**
 * Only this machine may change the switch. Requests without an Origin (curl, the
 * host half) and opaque origins (`null`, custom app schemes) are allowed; a plain
 * http(s) origin must point at a loopback host.
 * @param {import('node:http').IncomingMessage} request
 */
function fromThisMachine(request) {
  const header = request.headers.origin
  if (typeof header !== 'string' || header === '' || header === 'null') return true
  if (!/^https?:\/\//i.test(header)) return true
  try {
    const host = new URL(header).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

function send(response, status, body) {
  // A destroyed or already-answered response must not be written twice: the
  // second writeHead throws from inside a request callback, outside any try.
  if (response.writableEnded === true || response.destroyed === true) return
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  response.end(text)
}

/**
 * Start the sidecar on the first free port.
 * @param {{ logger?: { info: (m: string) => void, debug?: (m: string) => void } }} options
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export async function start({ logger } = {}) {
  let lastError
  for (const port of PORTS) {
    const outcome = await listen(port)
    if (outcome.server === null) {
      lastError = outcome.error
      continue
    }
    const server = outcome.server
    logger?.info?.(`cost display listening on ${origin()}:${port}`)
    return {
      port,
      close: () => new Promise(resolve => {
        server.close(() => resolve())
        server.closeAllConnections?.()
      }),
    }
  }
  throw lastError ?? new Error('no free port for the cost display')
}

function listen(port) {
  return new Promise(resolve => {
    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url ?? '/', origin())
        // The browser asks before it sends JSON: the page and this socket are on
        // different ports, so a POST carries a preflight. Answering it with 405
        // blocked every switch click — the click happened, the request never did.
        if (request.method === 'OPTIONS') {
          response.writeHead(204, {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'content-type',
            'access-control-max-age': '600',
          })
          return response.end()
        }
        if (request.method === 'POST' && url.pathname === '/switch') {
          // The port is open to every page in the browser, and this route changes
          // state: a page from the internet must not be able to flip the switch.
          if (!fromThisMachine(request)) return send(response, 403, { error: 'loopback only' })
          return readBody(request, response, body => {
            let payload = null
            try {
              payload = JSON.parse(body)
            } catch {
              return send(response, 400, { error: 'invalid json' })
            }
            const session = typeof payload?.session === 'string' ? payload.session : ''
            if (typeof switchHandler !== 'function') return send(response, 503, { error: 'the switch is not ready' })
            try {
              const status = switchNow(session, payload?.on === true)
              noteSwitch(session, payload?.on === true, status)
              return send(response, 200, { ok: true, status })
            } catch (error) {
              noteSwitch(session, payload?.on === true, null)
              return send(response, 500, { error: String(error) })
            }
          })
        }
        if (request.method !== 'GET') return send(response, 405, { error: 'GET only' })
        if (url.pathname === '/health') {
          return send(response, 200, { ok: true, name: 'dsh-auto-effort', peak: isPeak(), compatible: problems.length === 0, problems })
        }
        if (url.pathname === '/stats') {
          const session = resolveSessionId(url.searchParams.get('session') ?? '')
          return send(response, 200, { ...sessionStats(session), status: sessionStatus(session) ?? null, peak: isPeak() })
        }
        if (url.pathname === '/beacon') {
          noteBeacon(url.searchParams.get('where') ?? '')
          return send(response, 200, { ok: true })
        }
        if (url.pathname === '/totals') return send(response, 200, { ...totalStats(), peak: isPeak() })
        if (url.pathname === '/switch-log') return send(response, 200, { attempts: switchLog.slice() })
        return send(response, 404, { error: 'not found' })
      } catch (error) {
        return send(response, 500, { error: String(error) })
      }
    })
    server.once('error', error => {
      server.close()
      resolve({ server: null, error })
    })
    server.listen(port, '127.0.0.1', () => {
      // After a successful bind, a socket error would otherwise be an unhandled
      // 'error' event, which takes the whole process down.
      server.on('error', () => {})
      resolve({ server, error: null })
    })
    server.unref?.()
  })
}
