const DevSidecar = require('@docmirror/dev-sidecar')

const action = process.argv[2]
const name = process.argv[3]

// 前置校验参数
if (!['start', 'stop'].includes(action) || !name) {
  console.error('用法: ds-cli plugin <start|stop> <name>')
  process.exit(1)
}

DevSidecar.api.config.reload()

async function run () {
  const plugin = DevSidecar.api.plugin[name]
  if (!plugin) {
    console.error(`错误: 未找到名为 "${name}" 的插件`)
    process.exit(1)
  }

  if (action === 'start') {
    if (typeof plugin.start !== 'function') {
      console.error(`错误: 插件 "${name}" 不支持启动操作`)
      process.exit(1)
    }
    await plugin.start()
    console.log(`插件 ${name} 已启动`)
  } else if (action === 'stop') {
    // 部分插件可能使用 close 或 stop，此处兼容常见命名或做类型判断
    const closeFn = plugin.close || plugin.stop
    if (typeof closeFn !== 'function') {
      console.error(`错误: 插件 "${name}" 不支持停止操作`)
      process.exit(1)
    }
    await closeFn.call(plugin)
    console.log(`插件 ${name} 已停止`)
  }
}

run().catch((e) => {
  console.error('操作失败:', e?.message || e)
  process.exit(1)
})
