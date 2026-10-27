import { useEffect, useRef, useState } from 'react'

const DEFAULT_DAMPING = 17
const DEFAULT_MASS = 1
const DEFAULT_PRECISION = 0.025
const DEFAULT_SETTLE_VELOCITY = 0.025
const DEFAULT_STIFFNESS = 88
const MAX_FRAME_TIME = 0.034

const toFiniteNumber = (value, fallback = 0) => (
  Number.isFinite(value) ? value : fallback
)

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

const useDampedRotation = (targetRotation, options = {}) => {
  const {
    damping = DEFAULT_DAMPING,
    mass = DEFAULT_MASS,
    precision = DEFAULT_PRECISION,
    settleVelocity = DEFAULT_SETTLE_VELOCITY,
    stiffness = DEFAULT_STIFFNESS,
  } = options

  const safeTarget = toFiniteNumber(targetRotation)
  const [rotation, setRotation] = useState(safeTarget)
  const rotationRef = useRef(safeTarget)
  const velocityRef = useRef(0)

  useEffect(() => {
    let frameId = 0

    if (prefersReducedMotion()) {
      frameId = window.requestAnimationFrame(() => {
        rotationRef.current = safeTarget
        velocityRef.current = 0
        setRotation(safeTarget)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    let previousTimestamp = performance.now()

    const step = (timestamp) => {
      const elapsed = Math.min((timestamp - previousTimestamp) / 1000, MAX_FRAME_TIME)
      previousTimestamp = timestamp

      const displacement = safeTarget - rotationRef.current
      const springForce = displacement * stiffness
      const dampingForce = velocityRef.current * damping
      const acceleration = (springForce - dampingForce) / mass

      velocityRef.current += acceleration * elapsed
      rotationRef.current += velocityRef.current * elapsed

      if (
        Math.abs(safeTarget - rotationRef.current) <= precision
        && Math.abs(velocityRef.current) <= settleVelocity
      ) {
        rotationRef.current = safeTarget
        velocityRef.current = 0
        setRotation(safeTarget)
        return
      }

      setRotation(rotationRef.current)
      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [damping, mass, precision, safeTarget, settleVelocity, stiffness])

  return rotation
}

export default useDampedRotation
