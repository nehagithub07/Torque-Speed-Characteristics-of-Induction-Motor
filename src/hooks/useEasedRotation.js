import { useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION = 520
const MIN_DURATION = 120
const SETTLED_EPSILON = 0.001

const toFiniteNumber = (value, fallback = 0) => (
  Number.isFinite(value) ? value : fallback
)

const easeOutCubic = (progress) => (
  1 - (1 - progress) ** 3
)

const useEasedRotation = (targetRotation, options = {}) => {
  const { duration = DEFAULT_DURATION } = options
  const safeTarget = toFiniteNumber(targetRotation)
  const safeDuration = Number.isFinite(duration)
    ? Math.max(duration, MIN_DURATION)
    : DEFAULT_DURATION

  const [rotation, setRotation] = useState(safeTarget)
  const currentRotationRef = useRef(safeTarget)

  useEffect(() => {
    let frameId = 0
    const startRotation = currentRotationRef.current
    const rotationDelta = safeTarget - startRotation

    if (Math.abs(rotationDelta) <= SETTLED_EPSILON) {
      currentRotationRef.current = safeTarget
      setRotation(safeTarget)
      return undefined
    }

    const startTime = performance.now()

    const step = (timestamp) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(Math.max(elapsed / safeDuration, 0), 1)
      const nextRotation = startRotation + rotationDelta * easeOutCubic(progress)

      if (progress >= 1) {
        currentRotationRef.current = safeTarget
        setRotation(safeTarget)
        return
      }

      currentRotationRef.current = nextRotation
      setRotation(nextRotation)
      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [safeDuration, safeTarget])

  return rotation
}

export default useEasedRotation
