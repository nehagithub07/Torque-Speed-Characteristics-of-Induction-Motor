import { useId } from 'react'
import { getMotorLoadReading, MAX_MOTOR_LOAD_LEVEL } from '../utils/motorLoadReadings.js'

const ORIGINAL_BELTS = 'M 378 900 Q 390 1020 480 1110 M 735 900 Q 725 1010 638 1110'

const BeltStrand = ({ d, texture, side }) => (
  <g className={`pulley-belt__${side}`}>
    <path className="pulley-belt__strand" d={d} fill="none" stroke="#1c211d" strokeWidth="35" />
    <path className="pulley-belt__strand" d={d} fill="none" stroke={texture} strokeWidth="30" />
    <path className="pulley-belt__strand" d={d} fill="none" stroke="#b6b397" strokeWidth="1.5" strokeDasharray="2 4" />
  </g>
)

const BrakeBelt = ({ imageSrc, loadLevel }) => {
  const id = useId()
  const tension = getMotorLoadReading(loadLevel).loadLevel / MAX_MOTOR_LOAD_LEVEL
  // Fixed clamp/drum anchors; increasing load removes the outward bow.
  const left = `M 378 900 Q ${390 + 39 * tension} ${1020 - 15 * tension} 480 1110`
  const right = `M 735 900 Q ${725 - 38.5 * tension} ${1010 - 5 * tension} 638 1110`

  return (
    <g>
      <defs>
        <path id={`${id}-original-belts`} d={ORIGINAL_BELTS} fill="none" strokeWidth="42" />
        <mask id={`${id}-base`} maskUnits="userSpaceOnUse" x="0" y="0" width="1086" height="1448">
          <rect width="1086" height="1448" fill="white" />
          <use href={`#${id}-original-belts`} stroke="black" />
        </mask>
        <mask id={`${id}-belt-area`} maskUnits="userSpaceOnUse" x="0" y="0" width="1086" height="1448">
          <rect width="1086" height="1448" fill="black" />
          <use href={`#${id}-original-belts`} stroke="white" />
        </mask>
        <linearGradient id={`${id}-crossbar`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#a5afb0" />
          <stop offset="0.06" stopColor="#4d585f" />
          <stop offset="0.25" stopColor="#293238" />
          <stop offset="0.92" stopColor="#222a30" />
          <stop offset="1" stopColor="#879092" />
        </linearGradient>
        <pattern id={`${id}-weave`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#3c3d32" />
          <path d="M -2 2 L 2 -2 M 0 6 L 6 0 M 4 8 L 8 4" stroke="#b0ad91" strokeWidth="1" />
          <path d="M 0 0 L 6 6" stroke="#121914" strokeWidth="1.2" />
        </pattern>
        <clipPath id={`${id}-foreground`}>
          <ellipse cx="556" cy="1065" rx="96" ry="99" />
          <rect x="337" y="797" width="70" height="112" />
          <rect x="704" y="801" width="78" height="111" />
        </clipPath>
      </defs>
      {/* Remove the baked-in slack belt, retaining the shared apparatus. */}
      <image href={imageSrc} width="1086" height="1448" mask={`url(#${id}-base)`} />
      {/* Restore the crossbar behind the belt where the source obscured it. */}
      <g mask={`url(#${id}-belt-area)`} fill={`url(#${id}-crossbar)`}>
        <rect x="340" y="986" width="105" height="66" />
        <rect x="674" y="986" width="100" height="66" />
      </g>
      <g className="pulley-belt" data-belt-load={loadLevel} data-belt-tension={tension}>
        <BeltStrand side="left" d={left} texture={`url(#${id}-weave)`} />
        <BeltStrand side="right" d={right} texture={`url(#${id}-weave)`} />
      </g>
      {/* Belt ends remain behind the metal clamps and the front brake drum. */}
      <image href={imageSrc} width="1086" height="1448" clipPath={`url(#${id}-foreground)`} />
    </g>
  )
}

export default BrakeBelt
