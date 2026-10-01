const fs = require('node:fs')
const path = require('node:path')
const server = require('@docmirror/mitmproxy')
const jsonApi = require('@docmirror/mitmproxy/src/json')
const log = require('@docmirror/mitmproxy/src/utils/util.log.server') // 当前脚本是在 server 的进程中执行的，所以使用 mitmproxy 中的logger

// 修复：同时兼容 Windows 的 USERPROFILE 与环境变量
const home = process.env.USERPROFILE || process.env.USER_HOME || process.env.HOME || '/'

let configPath
if (process.argv && process.argv.length >= 3) {
  configPath = process.argv[2]
} else {
  configPath = path.join(home, '.dev-sidecar/running.json')
}

// 检查配置文件是否存在，避免直接抛出文件未找到异常
if (!fs.existsSync(configPath)) {
  log.error(`启动失败：配置文件不存在，路径：${configPath}`)
  process.exit(1)
}

let configJson
try {
  configJson = fs.readFileSync(configPath)
  log.info('读取 running.json by cli 成功:', configPath)
} catch (e) {
  log.error(`读取配置文件失败，路径：${configPath}，错误:`, e)
  process.exit(1)
}

let config = {}
try {
  config = jsonApi.parse(configJson.toString()) || {}
} catch (e) {
  log.error(`running.json 文件内容格式不正确，文件路径：${configPath}，文件内容: ${configJson.toString()}, error:`, e)
  config = {}
}

// 安全初始化 setting 对象，避免直接修改 undefined 属性报错
config.setting = config.setting || {}
config.setting.rootDir = path.join(__dirname, '../../gui/')

log.info(`start mitmproxy by cli, configPath: ${configPath}`)
server.start(config)
