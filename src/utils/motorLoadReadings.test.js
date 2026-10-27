import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BRAKE_DRUM_RADIUS, LINE_VOLTAGE, MOTOR_LOAD_READINGS, OBSERVATION_COLUMNS,
  calculateTorque, createMotorObservation, getMotorLoadReading,
} from './motorLoadReadings.js'
import { createReportHtml } from './reportGenerator.js'

const expectedRows = [
  [1, 256, 253, 240, 2.75, 2.86, 2.94, 0.27, 0, 0, 0, 1490],
  [2, 256, 253, 238, 2.85, 3, 3.13, 0.82, 7.5, 2, 4.04, 1462],
  [3, 265, 254, 236, 3.06, 3.24, 3.44, 1.14, 12, 2.5, 6.98, 1452],
  [4, 266, 253, 235, 3.35, 3.55, 3.78, 1.51, 16, 5, 8.09, 1436],
  [5, 267, 253, 235, 3.68, 3.9, 4.08, 1.85, 20, 6, 10.3, 1426],
  [6, 268, 253, 235, 3.79, 4.06, 4.05, 1.93, 22.5, 7, 11.4, 1420],
]

test('all six observations preserve the supplied measurements and column order', () => {
  assert.equal(MOTOR_LOAD_READINGS.length, 6)
  const observations = MOTOR_LOAD_READINGS.map((_, loadLevel) => createMotorObservation({ id: loadLevel + 1, loadLevel }))
  assert.deepEqual(observations.map(row => OBSERVATION_COLUMNS.map(({ key }) => row[key])), expectedRows)
  assert.equal(LINE_VOLTAGE, 400)
  assert.equal(BRAKE_DRUM_RADIUS, 0.075)
})

test('torque uses the weight difference, 0.075 m drum radius, and gravity', () => {
  assert.ok(Math.abs(calculateTorque(7.5, 2) - 4.046625) < 1e-10)
  assert.equal(calculateTorque(0, 0), 0)
  assert.equal(getMotorLoadReading(1).torque, 4.04)
})

test('load lookup stays within the six states and observations are independent copies', () => {
  assert.equal(getMotorLoadReading(-1).loadLevel, 0)
  assert.equal(getMotorLoadReading(100).loadLevel, 5)
  const saved = createMotorObservation({ id: 1, loadLevel: 0 })
  saved.w1 = 10
  assert.equal(getMotorLoadReading(0).w1, 0)
})

test('the generated report contains the six motor rows, torque formula, and relevant graphs', () => {
  const html = createReportHtml({
    baseHref: 'http://localhost/', iitLogoSrc: 'iit.png', virtualLabsLogoSrc: 'vlab.png',
    observations: MOTOR_LOAD_READINGS.map((_, loadLevel) => createMotorObservation({ id: loadLevel + 1, loadLevel })),
    sessionStart: Date.now() - 60000,
  })
  assert.match(html, /Speed vs Torque/)
  assert.match(html, /Total Input Power vs Torque/)
  assert.match(html, /T = \(W1 − W2\) × 0.075 × 9.81/)
  for (const row of expectedRows) assert.ok(html.includes('<tr>' + row.map(value => `<td>${value}</td>`).join('') + '</tr>'))
  assert.doesNotMatch(html.split('<script>')[0], /undefined|NaN|Voltage Regulation|Single Phase Transformer/)
})
