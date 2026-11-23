// Run against Vite with the schedule-v2 API proxy available. Set PLAYWRIGHT_MODULE
// to the path of an external Playwright installation if it isn't on the Node path.
const assert = require('node:assert/strict')
const { planned_calls: [call] } = require('../src/data/schedule-v2/pipeline-planned-calls-request.json')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const url = process.argv[2] || 'http://127.0.0.1:5174/'
const importPath = '/api/calls/import'
const isImport = (request) => new URL(request.url()).pathname === importPath
const csv = (name, calls) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(`date,start,group_id,calls\n${call.date},${call.start},${call.group_id},${calls}\n`),
})

async function main() {
  // Playwright launches Edge with an isolated temporary profile.
  const browser = await chromium.launch({ channel: 'msedge' })
  try {
    const page = await browser.newPage()
    console.log(`Edge ${browser.version()} · ${url}`)
    await page.goto(url)
    const input = page.getByLabel('Tệp cuộc gọi')
    const load = page.getByRole('button', { name: 'Nạp cuộc gọi', exact: true })
    const run = page.getByRole('button', { name: 'Chạy xếp lịch', exact: true })
    const download = page.getByRole('button', { name: 'Tải lịch mới nhất (CSV)', exact: true })
    const stale = page.getByText('Kết quả cũ. Chạy lại để xem lịch mới và mở nút tải CSV.')
    const filename = () => input.evaluate((element) => element.files[0]?.name ?? '')
    const imports = []
    page.on('request', (request) => { if (isImport(request)) imports.push(request) })

    async function schedule() {
      const reply = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/schedule-v2')
      await run.click()
      assert.equal((await reply).status(), 200)
      await page.locator('button:not(:disabled)').and(download).waitFor()
      assert.equal(await stale.count(), 0)
    }

    await page.getByRole('button', { name: 'Thay bằng cấu hình mẫu' }).click()
    await schedule()
    await input.dispatchEvent('cancel', { bubbles: true })
    assert.equal(await filename(), '')
    assert.equal(await load.isEnabled(), false)
    assert.equal(await download.isEnabled(), true)
    assert.equal(imports.length, 0)
    console.log('PASS cancel with no file: empty selection, import disabled, current export available')

    const fileA = csv('a.csv', 2)
    const fileB = csv('b.csv', 3)
    await input.setInputFiles(fileA)
    await input.dispatchEvent('cancel', { bubbles: true })
    assert.equal(await filename(), fileA.name)
    assert.equal(await load.isEnabled(), true)
    assert.equal(imports.length, 0)
    console.log('PASS cancel with A selected: A retained, import available, no request')

    await input.setInputFiles(fileA)
    await schedule()
    // A native same-file choice can emit cancel instead of change.
    await input.dispatchEvent('cancel', { bubbles: true })
    assert.equal(await filename(), fileA.name)
    assert.equal(await load.isEnabled(), true)
    assert.equal(await download.isEnabled(), true)
    assert.equal(imports.length, 0)
    console.log('PASS reselect A: A retained, import available, current export available')

    await input.setInputFiles(fileB)
    await stale.waitFor()
    assert.equal(await filename(), fileB.name)
    assert.equal(await load.isEnabled(), true)
    assert.equal(await download.isEnabled(), false)
    assert.equal(imports.length, 0)
    console.log('PASS A to B: B selected, result stale, export locked, no automatic import')

    let releaseImport
    const importGate = new Promise((resolve) => { releaseImport = resolve })
    await page.route((requestUrl) => requestUrl.pathname === importPath, async (route) => {
      await importGate
      await route.continue()
    }, { times: 1 })
    const reply = page.waitForResponse((response) => isImport(response.request()))
    try {
      await load.click()
      await page.getByText('Đang nạp cuộc gọi…').waitFor()
      assert.equal(await load.isEnabled(), false)
      assert.equal(await download.isEnabled(), false)
    } finally {
      releaseImport()
    }
    assert.equal((await reply).status(), 200)
    await page.getByText('Đã nạp 1 dòng.', { exact: false }).waitFor()
    assert.equal(imports.length, 1)
    assert.deepEqual(imports[0].postDataBuffer(), fileB.buffer)
    assert.equal(await filename(), '')
    assert.equal(await load.isEnabled(), false)
    console.log('PASS explicit import: B bytes sent once to API, controls locked while busy, selection cleared on success')

    await input.setInputFiles(fileA)
    await page.getByLabel('Định dạng tệp').selectOption('xlsx')
    assert.equal(await filename(), '')
    assert.equal(await load.isEnabled(), false)
    await page.getByLabel('Định dạng tệp').selectOption('csv')
    await input.setInputFiles(fileA)
    await page.getByRole('combobox', { name: 'Nguồn nhu cầu', exact: true }).selectOption('history')
    assert.equal(await filename(), '')
    assert.equal(await load.isEnabled(), false)
    assert.equal(imports.length, 1)
    console.log('PASS format and mode changes: file intentionally cleared, import disabled')
  } finally {
    await browser.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
