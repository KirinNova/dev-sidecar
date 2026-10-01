const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

function getExePath () {
  if (process.argv[0] && !process.argv[0].includes('node')) {
    return process.argv[0]
  }
  // 开发模式下，返回 node 路径和脚本路径，并确保各自加上引号以防路径含空格
  const nodePath = process.argv[0]
  const scriptPath = process.argv[1]
  return `"${nodePath}" "${scriptPath}"`
}

function tryExec (cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

// ── Linux (systemd user service) ─────────────────────

const LINUX_SERVICE_DIR = path.join(
  process.env.HOME || '/', '.config/systemd/user',
)
const LINUX_SERVICE_PATH = path.join(LINUX_SERVICE_DIR, 'ds-cli.service')

function installLinux () {
  const exePath = getExePath()
  const service = `[Unit]
Description=DevSidecar CLI Proxy
After=network.target

[Service]
Type=simple
ExecStart=${exePath} start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
  try {
    fs.mkdirSync(LINUX_SERVICE_DIR, { recursive: true })
    fs.writeFileSync(LINUX_SERVICE_PATH, service)
    tryExec('systemctl --user daemon-reload')
    const result = tryExec('systemctl --user enable ds-cli')
    if (result === null) {
      console.log('已生成 systemd service 文件，但 enable 失败')
      console.log(`  文件位置: ${LINUX_SERVICE_PATH}`)
      console.log('  请手动执行: systemctl --user enable ds-cli')
    } else {
      console.log('已注册开机自启动 (systemd user service)')
    }
  } catch (e) {
    console.error(`注册开机自启动失败: ${e.message}`)
    console.log(`  请手动将以下内容保存到 ${LINUX_SERVICE_PATH}:`)
    console.log(service)
  }
}

function uninstallLinux () {
  if (fs.existsSync(LINUX_SERVICE_PATH)) {
    tryExec('systemctl --user disable ds-cli')
    tryExec('systemctl --user stop ds-cli')
    fs.unlinkSync(LINUX_SERVICE_PATH)
    tryExec('systemctl --user daemon-reload')
    console.log('已移除开机自启动')
  } else {
    console.log('开机自启动未注册')
  }
}

function isInstalledLinux () {
  return fs.existsSync(LINUX_SERVICE_PATH)
}

// ── macOS (launchd) ──────────────────────────────────

const MAC_PLIST_NAME = 'com.dev-sidecar.cli.plist'
const MAC_PLIST_PATH = path.join(
  process.env.HOME || '/', 'Library/LaunchAgents', MAC_PLIST_NAME,
)

function installMac () {
  const exePath = getExePath()
  const logPath = path.join(process.env.HOME || '/', '.dev-sidecar/logs/cli.log')
  
  // 如果是开发模式（带空格的组合路径），launchd 的 ProgramArguments 需要拆成多项
  let args = []
  if (process.argv[0] && !process.argv[0].includes('node')) {
    args = [`<string>${process.argv[0]}</string>`, '<string>start</string>']
  } else {
    args = [
      `<string>${process.argv[0]}</string>`,
      `<string>${process.argv[1]}</string>`,
      '<string>start</string>',
    ]
  }

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.dev-sidecar.cli</string>
  <key>ProgramArguments</key>
  <array>
    ${args.join('\n    ')}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>
`
  try {
    fs.mkdirSync(path.dirname(MAC_PLIST_PATH), { recursive: true })
    fs.writeFileSync(MAC_PLIST_PATH, plist)
    tryExec(`launchctl load ${MAC_PLIST_PATH}`)
    console.log('已注册开机自启动 (launchd)')
  } catch (e) {
    console.error(`注册开机自启动失败: ${e.message}`)
  }
}

function uninstallMac () {
  if (fs.existsSync(MAC_PLIST_PATH)) {
    tryExec(`launchctl unload ${MAC_PLIST_PATH}`)
    fs.unlinkSync(MAC_PLIST_PATH)
    console.log('已移除开机自启动')
  } else {
    console.log('开机自启动未注册')
  }
}

function isInstalledMac () {
  return fs.existsSync(MAC_PLIST_PATH)
}

// ── Windows (Registry Run key) ───────────────────────

const WIN_REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const WIN_REG_VALUE = 'ds-cli'

function installWindows () {
  const exePath = getExePath()
  // Windows 注册表 Run 键值格式要求：如果是带参数的命令，整体带引号或者用绝对路径
  const regCommand = process.argv[0] && !process.argv[0].includes('node')
    ? `"${exePath}" start`
    : `"${process.argv[0]}" "${process.argv[1]}" start`

  try {
    execSync(
      `reg add "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}" /t REG_SZ /d "${regCommand.replace(/"/g, '\\"')}" /f`,
      { stdio: 'ignore' },
    )
    console.log('已注册开机自启动 (注册表)')
  } catch (e) {
    console.error(`注册开机自启动失败: ${e.message}`)
  }
}

function uninstallWindows () {
  try {
    execSync(`reg delete "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}" /f`, { stdio: 'ignore' })
    console.log('已移除开机自启动')
  } catch {
    console.log('开机自启动未注册')
  }
}

function isInstalledWindows () {
  try {
    const out = execSync(`reg query "${WIN_REG_KEY}" /v "${WIN_REG_VALUE}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return out.includes(WIN_REG_VALUE)
  } catch {
    return false
  }
}

// ── 统一接口 ─────────────────────────────────────────

function install () {
  switch (process.platform) {
    case 'linux': return installLinux()
    case 'darwin': return installMac()
    case 'win32': return installWindows()
    default:
      console.error(`不支持的平台: ${process.platform}`)
      process.exit(1)
  }
}

function uninstall () {
  switch (process.platform) {
    case 'linux': return uninstallLinux()
    case 'darwin': return uninstallMac()
    case 'win32': return uninstallWindows()
    default:
      console.error(`不支持的平台: ${process.platform}`)
      process.exit(1)
  }
}

function isInstalled () {
  switch (process.platform) {
    case 'linux': return isInstalledLinux()
    case 'darwin': return isInstalledMac()
    case 'win32': return isInstalledWindows()
    default: return false
  }
}

module.exports = { install, uninstall, isInstalled }
