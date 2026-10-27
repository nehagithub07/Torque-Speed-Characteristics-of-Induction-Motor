export const AUTOTRANSFORMER_OUTPUT_VOLTAGE = 230
export const NO_LOAD_SECONDARY_VOLTAGE = 118
export const MAX_LAMP_LOAD_LEVEL = 4

export const LAMP_LOAD_READING_BY_LEVEL = {
  0: { a1Current: 1.02, a2Current: 0, lowerVoltage: NO_LOAD_SECONDARY_VOLTAGE, wattmeterPower: 20 },
  1: { a1Current: 1.37, a2Current: 1.5, lowerVoltage: 116, wattmeterPower: 115 },
  2: { a1Current: 2.22, a2Current: 3.7, lowerVoltage: 114.5, wattmeterPower: 245 },
  3: { a1Current: 3.37, a2Current: 6.2, lowerVoltage: 112, wattmeterPower: 385 },
  4: { a1Current: 4.32, a2Current: 8.2, lowerVoltage: 110, wattmeterPower: 495 },
}

const OBSERVATION_RESULT_BY_LEVEL = {
  0: { voltageRegulation: 0.0, efficiency: 0.0 },
  1: { voltageRegulation: 1.72, efficiency: 75.65 },
  2: { voltageRegulation: 3.05, efficiency: 86.46 },
  3: { voltageRegulation: 5.53, efficiency: 90.18 },
  4: { voltageRegulation: 7.27, efficiency: 91.11 },
}

const clampLoadLevel = (loadLevel) => (
  Math.min(Math.max(Math.trunc(Number(loadLevel) || 0), 0), MAX_LAMP_LOAD_LEVEL)
)

export const getLampLoadReading = (loadLevel) => (
  LAMP_LOAD_READING_BY_LEVEL[clampLoadLevel(loadLevel)] ?? LAMP_LOAD_READING_BY_LEVEL[0]
)

export const createTransformerObservation = ({ id, loadLevel }) => {
  const normalizedLoadLevel = clampLoadLevel(loadLevel)
  const reading = getLampLoadReading(normalizedLoadLevel)
  const primaryVoltage = AUTOTRANSFORMER_OUTPUT_VOLTAGE
  const primaryCurrent = reading.a1Current
  const wattmeterPower = reading.wattmeterPower
  const primaryPower = wattmeterPower * 2
  const secondaryVoltage = reading.lowerVoltage
  const secondaryCurrent = reading.a2Current
  const secondaryPower = secondaryVoltage * secondaryCurrent
  const { efficiency, voltageRegulation } = OBSERVATION_RESULT_BY_LEVEL[normalizedLoadLevel]

  return {
    efficiency,
    id,
    loadLevel: normalizedLoadLevel,
    primaryCurrent,
    primaryPower,
    primaryVoltage,
    secondaryCurrent,
    secondaryPower,
    secondaryVoltage,
    voltage: primaryVoltage,
    voltageRegulation,
    wattmeterPower,
    i1: primaryCurrent,
    i2: secondaryCurrent,
    i3: secondaryPower,
  }
}
