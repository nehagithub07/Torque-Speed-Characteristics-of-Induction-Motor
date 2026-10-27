import { useEffect, useRef } from 'react'
import pulley1 from '../assets/1.png'
import pulley2 from '../assets/2.png'
import pulley3 from '../assets/3.png'
import pulley4 from '../assets/4.png'
import pulley5 from '../assets/5.png'
import pulley6 from '../assets/6.png'
import handImg from '../assets/pulley-hand.png'
import ApparatusTerminal from './ApparatusTerminal.jsx'
import { getMotorLoadReading, MAX_MOTOR_LOAD_LEVEL } from '../utils/motorLoadReadings.js'

const pulleyImages = [pulley1, pulley2, pulley3, pulley4, pulley5, pulley6]

const Pulley = ({
  loadLevel = 0, turning = false, canIncreaseLoad = false, readingsReady = false,
  onIncreaseLoad, onTurningChange, loadHint = 'Complete the wiring and switch on the supply.',
}) => {
  const timersRef = useRef([])
  const busyRef = useRef(false)
  const reading = getMotorLoadReading(loadLevel)
  const image = pulleyImages[reading.loadLevel]

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])
  useEffect(() => {
    pulleyImages.forEach(src => { const image = new Image(); image.src = src })
  }, [])

  const turnHandle = () => {
    if (!canIncreaseLoad || busyRef.current || loadLevel >= MAX_MOTOR_LOAD_LEVEL) return
    busyRef.current = true
    onTurningChange?.(true)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timersRef.current = [
      setTimeout(() => onIncreaseLoad?.(), reducedMotion ? 40 : 900),
      setTimeout(() => {
        busyRef.current = false
        onTurningChange?.(false)
      }, reducedMotion ? 80 : 1500),
    ]
  }

  return (
    <article className={`pulley-device ${turning ? 'pulley-device--turning' : ''}`} id="pulley-device" aria-label="Pulley and brake-load assembly">
      <img
        alt={`Load ${loadLevel}: W1 ${reading.w1} kg, W2 ${reading.w2} kg`}
        className="pulley-device__image pulley-device__body"
        src={image}
        draggable={false}
      />
      <img className="pulley-device__image pulley-device__handle" src={image} alt="" aria-hidden="true" draggable={false} />
      <button
        id="pulley-hand-control"
        className="pulley-hand"
        type="button"
        onClick={turnHandle}
        disabled={!canIncreaseLoad || turning}
        aria-label={turning ? 'Turning the pulley handle' : 'Turn pulley handle to increase brake load'}
        aria-describedby="pulley-load-hint"
        title={loadHint}
      >
        <img src={handImg} alt="Hand gripping the pulley handle" draggable={false} />
      </button>
      <div className="pulley-load-info" aria-live="polite">
        <strong>W1: {reading.w1} kg · W2: {reading.w2} kg</strong>
        <span>{readingsReady ? `${reading.speed} RPM` : 'Motor off'} · Load {loadLevel}/{MAX_MOTOR_LOAD_LEVEL}</span>
        <span id="pulley-load-hint">{loadHint}</span>
      </div>
      {[16, 17, 18].map(number => <ApparatusTerminal key={number} number={number} />)}
    </article>
  )
}

export default Pulley
