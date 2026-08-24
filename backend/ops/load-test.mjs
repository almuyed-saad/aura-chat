import { io } from 'socket.io-client'

const baseUrl = (process.env.LOAD_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
const usersJson = process.env.LOAD_TEST_USERS || ''
const messagesPerUser = Math.min(Math.max(Number.parseInt(process.env.LOAD_TEST_MESSAGES_PER_USER || '25', 10), 1), 500)
const messageSize = Math.min(Math.max(Number.parseInt(process.env.LOAD_TEST_MESSAGE_SIZE || '240', 10), 20), 1000)
const sendTimeoutMs = Math.min(Math.max(Number.parseInt(process.env.LOAD_TEST_SEND_TIMEOUT_MS || '10000', 10), 1000), 30000)
const maxFailureRate = Math.min(Math.max(Number.parseFloat(process.env.LOAD_TEST_MAX_FAILURE_RATE || '0.05'), 0), 1)
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const dryRun = process.env.LOAD_TEST_DRY_RUN === 'true'
const confirmed = process.env.LOAD_TEST_CONFIRM === 'I_UNDERSTAND_TEST_DATA'
const allowProduction = process.env.LOAD_TEST_ALLOW_PRODUCTION === 'true'

const isPublicTarget = /(?:onrender\.com|vercel\.app|aura-chat)/i.test(baseUrl)
if (isPublicTarget && !allowProduction) {
  throw new Error('Refusing to load-test a public target. Use a staging URL or set LOAD_TEST_ALLOW_PRODUCTION=true explicitly.')
}
if (!dryRun && !confirmed) {
  throw new Error('Set LOAD_TEST_CONFIRM=I_UNDERSTAND_TEST_DATA; this test creates real messages and should normally run against staging.')
}
if (!usersJson) {
  throw new Error('LOAD_TEST_USERS must be a JSON array of {email,password} objects; credentials are read from the environment only.')
}

let users
try {
  users = JSON.parse(usersJson)
} catch {
  throw new Error('LOAD_TEST_USERS is not valid JSON')
}
if (!Array.isArray(users) || users.length < 2 || users.some(user => !user?.email || !user?.password)) {
  throw new Error('LOAD_TEST_USERS must contain at least two objects with email and password')
}

if (dryRun) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    target: baseUrl,
    users: users.length,
    messagesPerUser,
    messageSize,
    maxFailureRate
  }))
  process.exit(0)
}

const stats = {
  login: { ok: 0, failed: 0, durations: [] },
  connect: { ok: 0, failed: 0, durations: [] },
  send: { ok: 0, failed: 0, timeout: 0, durations: [] },
  history: { ok: 0, failed: 0, durations: [] }
}

const percentile = (values, fraction) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || body.error || `HTTP ${response.status}`)
  return body
}

const timed = async (operation) => {
  const started = performance.now()
  const result = await operation()
  return { result, duration: Math.round(performance.now() - started) }
}

const login = async (credentials) => {
  const attempt = await timed(() => requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: credentials.email, password: credentials.password })
  }))
  stats.login.durations.push(attempt.duration)
  stats.login.ok += 1
  return attempt.result
}

const connectSocket = async (token) => {
  const socket = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: sendTimeoutMs
  })
  const started = performance.now()
  await new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup()
      resolve()
    }
    const onError = (error) => {
      cleanup()
      reject(error instanceof Error ? error : new Error('Socket connection failed'))
    }
    const cleanup = () => {
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
    }
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
  })
  stats.connect.durations.push(Math.round(performance.now() - started))
  stats.connect.ok += 1
  return socket
}

const sendMessage = (socket, receiverId, text, clientMessageId) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    stats.send.timeout += 1
    stats.send.failed += 1
    reject(new Error('message acknowledgement timeout'))
  }, sendTimeoutMs)
  const started = performance.now()
  const onAcknowledged = (payload = {}) => {
    if (payload.clientMessageId !== clientMessageId) return
    clearTimeout(timer)
    socket.off('messageAcknowledged', onAcknowledged)
    socket.off('messageError', onError)
    stats.send.ok += 1
    stats.send.durations.push(Math.round(performance.now() - started))
    resolve(payload.message)
  }
  const onError = (payload = {}) => {
    if (payload.clientMessageId && payload.clientMessageId !== clientMessageId) return
    clearTimeout(timer)
    socket.off('messageAcknowledged', onAcknowledged)
    socket.off('messageError', onError)
    stats.send.failed += 1
    reject(new Error(payload.error || 'message send failed'))
  }
  socket.on('messageAcknowledged', onAcknowledged)
  socket.on('messageError', onError)
  socket.emit('sendMessage', { receiverId, text, clientMessageId })
})

const runUser = async (index, accounts) => {
  const credentials = users[index]
  const target = accounts[(index + 1) % accounts.length]
  const session = await login(credentials)
  const socket = await connectSocket(session.token)
  try {
    for (let messageIndex = 0; messageIndex < messagesPerUser; messageIndex += 1) {
      const clientMessageId = `load-${runId}-${index}-${messageIndex}`
      const body = `Aura load test ${runId} user ${index + 1} message ${messageIndex + 1} ${'x'.repeat(messageSize)}`.slice(0, 1000)
      await sendMessage(socket, target.user.id || target.user._id, body, clientMessageId)
    }

    const history = await timed(() => requestJson(`/api/messages/${target.user.id || target.user._id}?limit=50`, {
      headers: { Authorization: `Bearer ${session.token}` }
    }))
    stats.history.ok += 1
    stats.history.durations.push(history.duration)
  } catch (error) {
    console.error(`load user ${index + 1} failed: ${error.message}`)
  } finally {
    socket.disconnect()
  }
}

try {
  const loginResults = await Promise.all(users.map(login))
  const accounts = loginResults.map(result => ({ user: result.user }))
  await Promise.all(accounts.map((_, index) => runUser(index, accounts)))

  const totalSendAttempts = stats.send.ok + stats.send.failed
  const failureRate = totalSendAttempts ? stats.send.failed / totalSendAttempts : 1
  const report = {
    target: baseUrl,
    users: users.length,
    messagesPerUser,
    totalMessagesAttempted: totalSendAttempts,
    successfulMessages: stats.send.ok,
    failedMessages: stats.send.failed,
    acknowledgementTimeouts: stats.send.timeout,
    failureRate: Number(failureRate.toFixed(4)),
    loginP95Ms: percentile(stats.login.durations, 0.95),
    connectP95Ms: percentile(stats.connect.durations, 0.95),
    sendP95Ms: percentile(stats.send.durations, 0.95),
    historyP95Ms: percentile(stats.history.durations, 0.95)
  }
  console.log(JSON.stringify(report, null, 2))
  if (failureRate > maxFailureRate || stats.login.failed > 0 || stats.connect.failed > 0 || stats.history.failed > 0) {
    process.exitCode = 1
  }
} catch (error) {
  console.error(`load test aborted: ${error.message}`)
  process.exitCode = 1
}
