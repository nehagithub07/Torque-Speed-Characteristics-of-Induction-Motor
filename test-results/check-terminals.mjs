import puppeteer from 'puppeteer'
import assert from 'node:assert/strict'
import { TERMINALS_BY_NUMBER, REQUIRED_CONNECTION_PAIRS } from '../src/config/circuitConnections.js'

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle0' })
  await page.waitForSelector('#pulley-terminal-18')
  assert.equal(await page.$$eval('.connection-terminal', elements => elements.length), 18)
  assert.equal(await page.$$eval('[id*="jtk"], [class*="jtk"]', elements => elements.length), 0)
  await page.screenshot({ path: 'test-results/terminals-unconnected.png', fullPage: true })

  const id = number => '#' + TERMINALS_BY_NUMBER[number].id
  const dismiss = async () => {
    const button = await page.$('[aria-label="Close alert"]')
    if (button) {
      await button.click()
      await page.waitForSelector('.lab-alert-card', { hidden: true })
    }
  }
  const count = expected => page.waitForFunction(n => document.querySelectorAll('.circuit-wire:not(.circuit-wire--preview)').length === n, {}, expected)
  const drag = async (a, b) => {
    const center = selector => page.$eval(selector, element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })
    const start = await center(id(a))
    const end = await center(id(b))
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up()
  }

  await drag(1, 4)
  await count(1)
  assert.equal(await page.$eval('.circuit-wire', element => element.dataset.connection), '1-4')
  await page.click(id(1) + '-label')
  await count(0)
  await page.click(id(2))
  await page.click(id(5))
  await count(1)
  await page.focus(id(3))
  await page.keyboard.press('Enter')
  await page.focus(id(6))
  await page.keyboard.press('Space')
  await count(2)
  await drag(1, 5)
  await count(3)
  await page.click('#check-button')
  await page.waitForFunction(() => document.body.innerText.includes('Wrong Connection'))
  assert.ok(await page.evaluate(() => document.body.innerText.includes('1-5')))
  await dismiss()
  await page.click(id(1) + '-label')
  await count(2)
  await page.click('#check-button')
  await page.waitForFunction(() => document.body.innerText.includes('Missing Connections'))
  await dismiss()
  await drag(1, 4)
  for (const [a, b] of REQUIRED_CONNECTION_PAIRS.slice(3)) await drag(a, b)
  await count(9)
  await page.screenshot({ path: 'test-results/terminals-manual-wiring.png', fullPage: true })
  await page.click('#check-button')
  await page.waitForFunction(() => document.body.innerText.includes('Connections Verified'))
  await dismiss()
  await page.click(id(1) + '-label')
  await count(9)
  await page.click('#power-toggle-button')
  await page.waitForSelector('.mcb-device--on')
  await dismiss()
  await page.click('#reset-button')
  await count(0)
  await dismiss()
  await page.click('#auto-connect-button')
  await count(9)
  await dismiss()

  const pairs = await page.$$eval('.circuit-wire', elements => elements.map(element => element.dataset.connection))
  assert.deepEqual(pairs, REQUIRED_CONNECTION_PAIRS.map(pair => pair.join('-')))
  const ids = await page.$$eval('[id]', elements => elements.map(element => element.id))
  assert.equal(new Set(ids).size, ids.length)
  await page.screenshot({ path: 'test-results/terminals-auto-wiring.png', fullPage: true })
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 })
  await page.waitForFunction(() => document.querySelector('#equipment-panel').getBoundingClientRect().right <= window.innerWidth)
  await page.screenshot({ path: 'test-results/terminals-tablet.png', fullPage: true })
  const endpointError = await page.evaluate(() => {
    const svg = document.querySelector('#circuit-wires')
    return Math.max(...[...document.querySelectorAll('.circuit-wire')].map(path => {
      const start = path.getPointAtLength(0).matrixTransform(svg.getScreenCTM())
      const rect = document.getElementById(path.dataset.sourceTerminal).getBoundingClientRect()
      return Math.hypot(start.x - (rect.left + rect.width / 2), start.y - (rect.top + rect.height / 2))
    }))
  })
  assert.ok(endpointError < 1, 'wire start remains aligned after resize')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ result: 'PASS', terminalCount: 18, pairs, endpointError,
    checks: ['drag', 'click and keyboard connections', 'label removal', 'wrong and missing validation', 'manual completion', 'locking', 'MCB power', 'reset', 'exact auto wiring', 'unique readable IDs', 'no library selectors', 'scaled wire alignment', 'no browser errors'] }, null, 2))
} finally {
  await browser.close()
}
