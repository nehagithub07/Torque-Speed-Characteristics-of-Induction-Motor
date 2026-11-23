import { useEffect, useId, useRef, useState } from 'react'
import pulleyBase from '../assets/1.png'
import handImg from '../assets/pulley-hand.png'
import ApparatusTerminal from './ApparatusTerminal.jsx'
import BrakeBelt from './BrakeBelt.jsx'
import { getMotorLoadReading, MAX_MOTOR_LOAD_LEVEL } from '../utils/motorLoadReadings.js'

const SPRING_SCALE_MAX_KG = 50
const springScaleTicks = Array.from({ length: SPRING_SCALE_MAX_KG }, (_, value) => value)
// Project the handle's horizontal turn around the fixed spindle and collar.
const HANDLE_ARMS = 'M 350 55 H 445 L 518 125 V 158 L 350 122 Z M 665 55 H 760 V 120 L 596 158 V 125 Z'
const HANDLE_TURN_PER_LOAD = 60
const FINAL_HANDLE_TURN_PER_LOAD = 30
const INITIAL_HANDLE_TURNS = 3

const SpringWeightDial = ({ cx, weight, label, faceFill }) => (
  <g className="spring-weight-dial" transform={`translate(${cx} 630)`} data-gauge={label} data-weight={weight}>
    {/* Cover the complete baked-in face, including its original zero needle. */}
    <circle r="97" fill={faceFill} stroke="#827b66" strokeWidth="1.5" />
    {springScaleTicks.map(value => (
      <g key={value} transform={`rotate(${value * 360 / SPRING_SCALE_MAX_KG})`}>
        <line x1="0" y1="-91" x2="0" y2={value % 5 === 0 ? '-80' : '-86'} stroke="#30312b" strokeWidth={value % 5 === 0 ? '2' : '1'} />
      </g>
    ))}
    {springScaleTicks.filter(value => value % 5 === 0).map(value => {
      const angle = value * 2 * Math.PI / SPRING_SCALE_MAX_KG
      return (
        <text key={value} x={Math.sin(angle) * 68} y={-Math.cos(angle) * 68 + 6} textAnchor="middle" fill="#222823" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="700">
          {value}
        </text>
      )
    })}
    <text x="-29" y="-13" textAnchor="middle" fill="#444437" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700">kg</text>
    <text x="-31" y="24" textAnchor="middle" fill="#444437" fontFamily="Arial, sans-serif" fontSize="12">{weight}</text>
    <g className="spring-weight-dial__needle" transform={`rotate(${weight * 360 / SPRING_SCALE_MAX_KG})`}>
      <path d="M -4 6 L -2 -71 L 0 -84 L 2 -71 L 4 6 Z" fill="#1e211e" stroke="#676451" strokeWidth="1" />
    </g>
    <circle r="12" fill="#332f25" stroke="#a69b7b" strokeWidth="2" />
    <circle r="7" fill="#cda566" stroke="#64533b" strokeWidth="1.5" />
    <circle r="2.5" fill="#382e21" />
  </g>
)

const Pulley = ({
  loadLevel = 0, turning = false, canIncreaseLoad = false,
  onIncreaseLoad, onTurningChange,
}) => {
  const timersRef = useRef([])
  const busyRef = useRef(false)
  const [beltTargetLoad, setBeltTargetLoad] = useState(null)
  const dialFaceId = useId()
  const reading = getMotorLoadReading(loadLevel)
  const handleLoad = beltTargetLoad ?? reading.loadLevel
  // Keep readings 1–4 unchanged. Shorter clockwise turns for readings 5–6
  // stay before the 270-degree edge-on flip of the projected handle artwork.
  const handleAngle = Math.min(handleLoad, INITIAL_HANDLE_TURNS) * HANDLE_TURN_PER_LOAD
    + Math.max(0, handleLoad - INITIAL_HANDLE_TURNS) * FINAL_HANDLE_TURN_PER_LOAD

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  const turnHandle = () => {
    if (!canIncreaseLoad || busyRef.current || loadLevel >= MAX_MOTOR_LOAD_LEVEL) return
    busyRef.current = true
    onTurningChange?.(true)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timersRef.current = [
      // The hand reaches and starts turning the handle at 35% of its animation.
      setTimeout(() => setBeltTargetLoad(reading.loadLevel + 1), reducedMotion ? 40 : 525),
      setTimeout(() => onIncreaseLoad?.(), reducedMotion ? 40 : 900),
      setTimeout(() => {
        busyRef.current = false
        setBeltTargetLoad(null)
        onTurningChange?.(false)
      }, reducedMotion ? 80 : 1500),
    ]
  }

  return (
    <article
      className={`pulley-device ${turning ? 'pulley-device--turning' : ''}`}
      id="pulley-device"
      aria-label="Pulley and brake-load assembly"
      style={{
        '--pulley-handle-angle': `${handleAngle}deg`,
      }}
    >
      <div className="pulley-device__image-frame">
        <svg
          role="img"
          aria-label={`Load ${reading.loadLevel}: W1 ${reading.w1} kg, W2 ${reading.w2} kg`}
          className="pulley-device__image"
          viewBox="0 0 1086 1448"
          preserveAspectRatio="xMidYMid meet"
          focusable="false"
        >
          <defs>
            <clipPath id={`${dialFaceId}-handle-arms`}>
              <path d={HANDLE_ARMS} />
            </clipPath>
            <mask id={`${dialFaceId}-fixed-apparatus`} maskUnits="userSpaceOnUse" x="0" y="0" width="1086" height="1448">
              <rect width="1086" height="1448" fill="white" />
              <path d={HANDLE_ARMS} fill="black" />
            </mask>
            <radialGradient id={dialFaceId} cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#fffdf1" />
              <stop offset="1" stopColor="#ece2c1" />
            </radialGradient>
          </defs>
          <g mask={`url(#${dialFaceId}-fixed-apparatus)`}>
            <BrakeBelt imageSrc={pulleyBase} loadLevel={handleLoad} />
          </g>
          <g
            className="pulley-handle__rotation"
            data-handle-load={handleLoad}
          >
            <image href={pulleyBase} width="1086" height="1448" clipPath={`url(#${dialFaceId}-handle-arms)`} />
          </g>
          <SpringWeightDial cx={365} label="W1" weight={reading.w1} faceFill={`url(#${dialFaceId})`} />
          <SpringWeightDial cx={751} label="W2" weight={reading.w2} faceFill={`url(#${dialFaceId})`} />
        </svg>
      </div>
      <button
        id="pulley-hand-control"
        className="pulley-hand"
        type="button"
        onClick={turnHandle}
        disabled={!canIncreaseLoad || turning}
        aria-label={turning ? 'Turning the pulley handle' : 'Turn pulley handle to increase brake load'}
      >
        <img src={handImg} alt="Hand gripping the pulley handle" draggable={false} />
      </button>
      {[16, 17, 18].map(number => <ApparatusTerminal key={number} number={number} />)}
    </article>
  )
}

export default Pulley
