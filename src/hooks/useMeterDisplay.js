import useEasedRotation from './useEasedRotation.js'
import { getMeterNeedleRotation } from '../utils/meterNeedle.js'

const useMeterDisplay = (targetValue, rotationByReading) => {
  const targetRotation = getMeterNeedleRotation(targetValue, rotationByReading)
  const rotation = useEasedRotation(targetRotation)

  return {
    rotation,
  }
}

export default useMeterDisplay
