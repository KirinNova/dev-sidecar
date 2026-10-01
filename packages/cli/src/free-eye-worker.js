const DevSidecar = require('@docmirror/dev-sidecar')

DevSidecar.api.config.reload()

async function run () {
  console.log('正在运行 free_eye 测试...\n')
  const result = await DevSidecar.api.plugin.free_eye.start()

  if (!result) {
    console.error('错误: 测试未返回任何结果')
    process.exit(1)
  }

  console.log('=== free_eye 测试结果 ===')
  if (result.finishedAt) console.log(`完成时间: ${result.finishedAt}`)
  if (result.totalTests !== undefined) console.log(`总测试数: ${result.totalTests}`)
  if (result.completedTests !== undefined) console.log(`已完成:   ${result.completedTests}`)

  if (result.summaries && Array.isArray(result.summaries) && result.summaries.length > 0) {
    console.log('\n摘要:')
    for (const s of result.summaries) {
      console.log(`  ${s}`)
    }
  }

  if (result.error) {
    console.error(`\n错误: ${result.error}`)
    process.exit(1)
  }
}

run().catch((e) => {
  console.error('测试执行失败:', e.message)
  process.exit(1)
})
