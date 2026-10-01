const fs = require('node:fs')
const { PID_FILE } = require('./start')

function isAlive (pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function stopDaemon () {
  if (!fs.existsSync(PID_FILE)) {
    console.log('dev-sidecar 未在运行')
    return
  }

  const content = fs.readFileSync(PID_FILE, 'utf-8').trim()
  const pid = parseInt(content, 10)

  if (isNaN(pid) || pid <= 0 || !isAlive(pid)) {
    console.log('dev-sidecar 进程已不存在，清理 PID 文件')
    try {
      fs.unlinkSync(PID_FILE)
    } catch {}
    return
  }

  process.kill(pid, 'SIGINT')
  console.log(`已发送停止信号到 PID: ${pid}`)

  let waited = 0
  while (isAlive(pid) && waited < 5000) {
    await sleep(200)
    waited += 200
  }

  if (isAlive(pid)) {
    console.log(`进程未响应 SIGINT，正在强制终止 (PID: ${pid})...`)
    try {
      process.kill(pid, 'SIGKILL')
      await sleep(200)
    } catch (e) {
      console.error(`强制终止进程失败: ${e.message}`)
    }
  }

  if (fs.existsSync(PID_FILE)) {
    try {
      fs.unlinkSync(PID_FILE)
    } catch {}
  }

  console.log('dev-sidecar 已停止')
}

module.exports = { stopDaemon }
