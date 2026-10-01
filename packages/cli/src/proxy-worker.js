const DevSidecar = require('@docmirror/dev-sidecar')

const action = process.argv[2]

if (!['on', 'off'].includes(action)) {
  console.error('用法: ds-cli proxy <on|off>')
  process.exit(1)
}

DevSidecar.api.config.reload()

async function run () {
  const proxyApi = DevSidecar.api?.proxy
  if (!proxyApi) {
    console.error('错误: 代理 API 不可用')
    process.exit(1)
  }

  if (action === 'on') {
    if (typeof proxyApi.start === 'function') {
      await proxyApi.start()
    }
    try {
      await DevSidecar.api.instance?.updateStatus?.('proxy.enabled', true)
    } catch {}
    console.log('系统代理已开启')
  } else if (action === 'off') {
    const closeFn = proxyApi.close || proxyApi.stop
    if (typeof closeFn === 'function') {
      await closeFn.call(proxyApi)
    }
    try {
      await DevSidecar.api.instance?.updateStatus?.('proxy.enabled', false)
    } catch {}
    console.log('系统代理已关闭')
  }
}

run().catch((e) => {
  console.error('操作失败:', e?.message || e)
  process.exit(1)
})
