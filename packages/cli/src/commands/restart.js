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

async function restartDaemon () {
  const { startDaemon } = require('./start')

  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim()
    const pid = parseInt(content, 10)

    if (!isNaN(pid) && pid > 0 && isAlive(pid)) {
      console.log(`正在停止 dev-sidecar (PID: ${pid})...`)
      process.kill(pid, 'SIGINT')

      for (let i = 0; i < 50; i++) {
        if (!isAlive(pid)) break
        await sleep(100)
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
    }

    if (fs.existsSync(PID_FILE)) {
      try {
        fs.unlinkSync(PID_FILE)
      } catch {}
    }
  }

  await startDaemon()
}

module.exports = { restartDaemon }
