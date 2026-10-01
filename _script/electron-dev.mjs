import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'

const guiDir = process.cwd()
const require = createRequire(import.meta.url)

function resolveDevServer () {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: {
        type: 'string',
        default: '8080',
      },
    },
    strict: false,
  })

  const port = Number.parseInt(values.port, 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`无效的端口号: ${values.port}`)
  }
  return { port, url: `http://localhost:${port}` }
}

const { port: devServerPort, url: devServerUrl } = resolveDevServer()
const state = {
  closing: false,
  devServer: null,
  electron: null,
}

function spawnCommand (entry, args = [], extraEnv = {}) {
  return spawn(entry, args, {
    cwd: guiDir,
    env: { ...process.env, ...extraEnv },
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  })
}

function resolveVueCliServiceBin () {
  return require.resolve('@vue/cli-service/bin/vue-cli-service.js', {
    paths: [guiDir],
  })
}

function resolveElectronBin () {
  return require('electron')
}

async function waitForServer (url, child) {
  const timeoutAt = Date.now() + 120000
  console.log(`正在等待开发服务器启动 (${url})...`)

  while (Date.now() < timeoutAt) {
    if (child.exitCode != null || child.signalCode != null) {
      throw new Error('开发服务器在就绪前意外退出')
    }

    try {
      await fetch(url, { method: 'GET' })
      console.log('开发服务器已就绪')
      return
    } catch {}

    await delay(500)
  }

  throw new Error(`等待服务启动超时: ${url}`)
}

function stopChild (child) {
  if (!child || child.exitCode != null || child.signalCode != null) {
    return
  }
  child.kill('SIGTERM')
}

async function shutdown (code = 0) {
  if (state.closing) {
    return
  }

  state.closing = true
  console.log('正在安全关闭所有进程...')
  
  stopChild(state.electron)
  stopChild(state.devServer)

  process.exitCode = code
}

process.on('SIGINT', () => void shutdown(0))
process.on('SIGTERM', () => void shutdown(0))

async function main () {
  const vueCliServiceBin = resolveVueCliServiceBin()
  const electronBin = resolveElectronBin()

  console.log('正在启动 Vue CLI 开发服务器...')
  state.devServer = spawnCommand(process.execPath, [
    vueCliServiceBin,
    'serve',
    '--port',
    String(devServerPort),
  ])

  state.devServer.on('exit', (code, signal) => {
    if (!state.closing) {
      console.warn('开发服务器意外终止')
      void shutdown(code ?? (signal ? 1 : 0))
    }
  })

  try {
    await waitForServer(devServerUrl, state.devServer)

    console.log('正在启动 Electron 客户端...')
    state.electron = spawnCommand(electronBin, ['.'], {
      WEBPACK_DEV_SERVER_URL: devServerUrl,
    })

    state.electron.on('exit', (code, signal) => {
      void shutdown(code ?? (signal ? 1 : 0))
    })
  } catch (error) {
    console.error('启动失败:', error.message)
    await shutdown(1)
  }
}

void main()
