#!/usr/bin/env node

/**
 * Local Lianke Cloud Print fake used by governance/e2e API tests.
 *
 * This process is intentionally a small HTTP fake rather than a Spring bean:
 * Playwright tests exercise the real backend LiankePrinterGateway and only
 * replace the remote Lianke service through LIANKE_PRINT_HOST.
 */

import http from 'node:http'
import { URL } from 'node:url'

const port = Number(process.env.LIANKE_FAKE_PORT ?? process.env.PORT ?? 18080)
const expectedApiKey = process.env.LIANKE_FAKE_API_KEY ?? 'e2e-fake-key'

const tasks = new Map()
const requests = []
let nextTaskNumber = 1
let config = defaultConfig()

function defaultConfig() {
  return {
    pageCount: 3,
    defaultTaskState: 'READY',
    cancelSuccess: true,
    filePagesSuccess: true,
    submitSuccess: true,
    callbackOnStateChange: true,
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function ok(res, data, msg = 'success') {
  json(res, 200, { code: 200, msg, data })
}

function fail(res, status, code, msg) {
  json(res, status, { code, msg, data: null })
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function parseJson(buffer) {
  if (!buffer.length) return {}
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    return {}
  }
}

function parseMultipart(buffer, contentType) {
  const fields = {}
  const match = /boundary=([^;]+)/i.exec(contentType ?? '')
  if (!match) return fields

  const boundary = `--${match[1].replace(/^"|"$/g, '')}`
  const body = buffer.toString('utf8')
  for (const part of body.split(boundary)) {
    const field = /name="([^"]+)"/i.exec(part)?.[1]
    if (!field) continue
    const separator = part.indexOf('\r\n\r\n')
    if (separator < 0) continue
    // Each form field is followed by CRLF and the multipart boundary. The
    // test payloads are scalar fields, so the first line is the exact value.
    fields[field] = part.slice(separator + 4).split('\r\n', 1)[0]
  }
  return fields
}

function redact(value) {
  if (value == null) return value
  return String(value).length > 4 ? `${String(value).slice(0, 2)}***` : '***'
}

function recordRequest(req, url, fields = {}) {
  const safeQuery = Object.fromEntries(url.searchParams.entries())
  if (safeQuery.deviceKey) safeQuery.deviceKey = redact(safeQuery.deviceKey)
  const safeFields = { ...fields }
  if (safeFields.deviceKey) safeFields.deviceKey = redact(safeFields.deviceKey)
  if (safeFields.jobFile) safeFields.jobFile = '[redacted]'
  requests.push({
    method: req.method,
    path: url.pathname,
    query: safeQuery,
    fields: safeFields,
    apiKeyPresent: req.headers.apikey === expectedApiKey,
  })
  if (requests.length > 200) requests.shift()
}

function requireApiKey(req, res) {
  if (req.headers.apikey !== expectedApiKey) {
    fail(res, 401, 401, 'invalid fake api key')
    return false
  }
  return true
}

function printerList() {
  return [{
    driver_name: 'E2E-PRINTER-MODEL',
    printer_name: 'E2E 测试打印机',
    port: '1',
    isPrinter: 1,
    printer_species: 4,
  }]
}

function taskResult(task) {
  if (task.state === 'SUCCESS') {
    return {
      code: 200,
      msg: '打印成功',
      data: {
        img_list: task.imgList ?? [],
        taskTicket: task.taskTicket ?? `ticket-${task.taskId}`,
      },
    }
  }
  if (task.state === 'FAILURE') {
    return {
      code: task.resultCode ?? 503,
      msg: task.resultMsg ?? '测试打印失败',
    }
  }
  return null
}

function taskResponse(task) {
  const result = taskResult(task)
  return {
    task_id: task.taskId,
    task_state: task.state,
    page_count: task.pageCount ?? config.pageCount,
    ...(result ? { task_result: result } : {}),
  }
}

async function notifyCallback(task) {
  if (!config.callbackOnStateChange || !task.callbackUrl) return
  try {
    await fetch(task.callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        device_id: task.deviceId,
        task_id: task.taskId,
        task_state: task.state,
        task_result: taskResult(task),
      }),
    })
  } catch (error) {
    console.error(`[lianke-fake] callback failed for ${task.taskId}: ${error.message}`)
  }
}

async function handleAdmin(req, res, url, body) {
  if (req.method === 'GET' && url.pathname === '/__health') {
    return json(res, 200, { status: 'ok', taskCount: tasks.size })
  }
  if (req.method === 'POST' && url.pathname === '/__admin/reset') {
    tasks.clear()
    requests.length = 0
    nextTaskNumber = 1
    config = defaultConfig()
    return json(res, 200, { ok: true })
  }
  if (req.method === 'POST' && url.pathname === '/__admin/config') {
    const incoming = parseJson(body)
    config = { ...config, ...incoming }
    return json(res, 200, { ok: true, config })
  }
  if (req.method === 'GET' && url.pathname === '/__admin/requests') {
    return json(res, 200, { requests })
  }
  const stateMatch = /^\/__admin\/tasks\/([^/]+)\/state$/.exec(url.pathname)
  if (req.method === 'POST' && stateMatch) {
    const task = tasks.get(decodeURIComponent(stateMatch[1]))
    if (!task) return json(res, 404, { ok: false, message: 'task not found' })
    const incoming = parseJson(body)
    task.state = incoming.state ?? task.state
    task.resultCode = incoming.resultCode
    task.resultMsg = incoming.resultMsg
    task.imgList = incoming.imgList
    task.taskTicket = incoming.taskTicket
    if (incoming.notifyCallback !== false) await notifyCallback(task)
    return json(res, 200, { ok: true, task: taskResponse(task) })
  }
  return false
}

async function handleLianke(req, res, url, body) {
  if (!requireApiKey(req, res)) return true

  let fields = {}
  if ((req.headers['content-type'] ?? '').includes('multipart/form-data')) {
    fields = parseMultipart(body, req.headers['content-type'])
  } else if ((req.headers['content-type'] ?? '').includes('application/json')) {
    fields = parseJson(body)
  }
  recordRequest(req, url, fields)

  if (req.method === 'GET' && url.pathname === '/api/external_api/printer_list') {
    return ok(res, { row: printerList(), total: 1 })
  }
  if (req.method === 'GET' && url.pathname === '/api/print/paper_dimension_list') {
    return ok(res, {
      A4: { paper_id: 9, physical_height: 2970, physical_width: 2100 },
      A5: { paper_id: 11, physical_height: 2100, physical_width: 1480 },
    })
  }
  if (req.method === 'GET' && url.pathname === '/api/print/printer_params') {
    return ok(res, {
      Capabilities: {
        Papers: { A4: 9, A5: 11 },
        Color: { 黑白: 1, 彩色: 2 },
        Orientation: { 竖向: 1, 横向: 2 },
        Duplex: { 单面: 1, 长边: 2, 短边: 3 },
      },
    })
  }
  if (req.method === 'POST' && url.pathname === '/api/print/file_pages') {
    if (!config.filePagesSuccess) return fail(res, 200, 500, 'fake file pages failure')
    return ok(res, { pages: config.pageCount })
  }
  if (req.method === 'POST' && url.pathname === '/api/print/job') {
    if (!config.submitSuccess) return fail(res, 200, 500, 'fake submit failure')
    const taskId = `e2e-task-${String(nextTaskNumber++).padStart(3, '0')}`
    tasks.set(taskId, {
      taskId,
      deviceId: fields.deviceId,
      deviceKey: fields.deviceKey,
      callbackUrl: fields.callbackUrl,
      state: config.defaultTaskState,
      pageCount: config.pageCount,
    })
    return ok(res, { task_id: taskId })
  }
  if (url.pathname === '/api/print/job') {
    const taskId = url.searchParams.get('task_id')
    const task = tasks.get(taskId)
    if (!task) return fail(res, 200, 404, 'task not found')
    if (req.method === 'GET') return ok(res, taskResponse(task))
    if (req.method === 'DELETE') {
      if (!config.cancelSuccess) return fail(res, 200, 500, 'fake cancel failure')
      task.state = 'REVOKED'
      return ok(res, { task_id: taskId, msg: '已取消' })
    }
  }
  return fail(res, 404, 404, 'fake route not found')
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
  const body = await readBody(req)
  try {
    if (url.pathname === '/__health' || url.pathname.startsWith('/__admin/')) {
      await handleAdmin(req, res, url, body)
      return
    }
    await handleLianke(req, res, url, body)
  } catch (error) {
    console.error(`[lianke-fake] request failed: ${error.stack ?? error}`)
    if (!res.headersSent) fail(res, 500, 500, 'fake server error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[lianke-fake] listening on http://127.0.0.1:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
