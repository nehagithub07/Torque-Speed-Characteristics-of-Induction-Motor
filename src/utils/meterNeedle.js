const toFiniteNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

export const getMeterNeedleRotation = (reading, rotationByReading) => {
  const readingKey = String(toFiniteNumber(reading))
  const configuredRotation = rotationByReading?.[readingKey]

  if (Number.isFinite(configuredRotation)) {
    return configuredRotation
  }

  return rotationByReading?.[0]
}
