export const LINE_VOLTAGE = 400
export const SUPPLY_FREQUENCY = 50
export const BRAKE_DRUM_RADIUS = 0.075
export const GRAVITY = 9.81

export const calculateTorque = (w1, w2) => (w1 - w2) * BRAKE_DRUM_RADIUS * GRAVITY

export const MOTOR_LOAD_READINGS = [
  { vr: 256, vy: 253, vb: 240, ir: 2.75, iy: 2.86, ib: 2.94, power: 0.27, w1: 0, w2: 0, speed: 1490 },
  { vr: 256, vy: 253, vb: 238, ir: 2.85, iy: 3, ib: 3.13, power: 0.82, w1: 7.5, w2: 2, speed: 1462 },
  { vr: 265, vy: 254, vb: 236, ir: 3.06, iy: 3.24, ib: 3.44, power: 1.14, w1: 12, w2: 2.5, speed: 1452 },
  { vr: 266, vy: 253, vb: 235, ir: 3.35, iy: 3.55, ib: 3.78, power: 1.51, w1: 16, w2: 5, speed: 1436 },
  { vr: 267, vy: 253, vb: 235, ir: 3.68, iy: 3.9, ib: 4.08, power: 1.85, w1: 20, w2: 6, speed: 1426 },
  { vr: 268, vy: 253, vb: 235, ir: 3.79, iy: 4.06, ib: 4.05, power: 1.93, w1: 22.5, w2: 7, speed: 1420 },
].map((reading, loadLevel) => ({
  ...reading,
  loadLevel,
  // The supplied table truncates torque to two decimal places (4.04, 6.98, ...).
  torque: Math.trunc((calculateTorque(reading.w1, reading.w2) + Number.EPSILON) * 100) / 100,
}))

export const MAX_MOTOR_LOAD_LEVEL = MOTOR_LOAD_READINGS.length - 1
export const getMotorLoadReading = loadLevel => MOTOR_LOAD_READINGS[
  Math.min(MAX_MOTOR_LOAD_LEVEL, Math.max(0, Math.trunc(Number(loadLevel) || 0)))
]
export const createMotorObservation = ({ id, loadLevel }) => ({ id, ...getMotorLoadReading(loadLevel) })

export const OBSERVATION_COLUMNS = [
  { key: 'id', label: 'S.No.', unit: '' },
  { key: 'vr', label: 'VR', unit: 'V' },
  { key: 'vy', label: 'VY', unit: 'V' },
  { key: 'vb', label: 'VB', unit: 'V' },
  { key: 'ir', label: 'IR', unit: 'A' },
  { key: 'iy', label: 'IY', unit: 'A' },
  { key: 'ib', label: 'IB', unit: 'A' },
  { key: 'power', label: 'P', unit: 'kW' },
  { key: 'w1', label: 'W1', unit: 'kg' },
  { key: 'w2', label: 'W2', unit: 'kg' },
  { key: 'torque', label: 'T', unit: 'N·m' },
  { key: 'speed', label: 'Speed', unit: 'RPM' },
]
