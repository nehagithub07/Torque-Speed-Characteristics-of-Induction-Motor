import ApparatusTerminal from './ApparatusTerminal.jsx'
import useMeterDisplay from '../hooks/useMeterDisplay.js'

const DIAL_CENTER = { x: 76, y: 84 }
const NEEDLE_RADIUS = 43
const TICK_RADIUS_INNER = 49
const TICK_RADIUS_OUTER = 56
const LABEL_RADIUS = 41

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getArcPoint = (ratio, radius) => {
  const angle = Math.PI - clamp(ratio, 0, 1) * Math.PI

  return {
    x: DIAL_CENTER.x + Math.cos(angle) * radius,
    y: DIAL_CENTER.y - Math.sin(angle) * radius,
  }
}

const scaleLabels = {
  ammeter: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  voltmeter: ['0', '40', '80', '120', '160', '200', '240'],
}

const AnalogMeter = ({
  ariaLabel,
  centerLabel,
  needleRotationByReading,
  terminalOwner,
  terminals,
  title,
  type,
  unit,
  value = 0,
}) => {
  const numericValue = Number.isFinite(value) ? value : 0
  const meterDisplay = useMeterDisplay(numericValue, needleRotationByReading)
  const minorTicks = Array.from({ length: 31 }, (_, index) => index / 30)

  return (
    <article className={`lab-meter lab-meter--${type}`} id={`${type}-meter`} aria-label={ariaLabel}>
      <div className="lab-meter__title">{title}</div>

      <svg className="lab-meter__gauge" viewBox="0 0 152 96" aria-hidden="true">
        <path className="lab-meter__scale-bg" d="M18 82 A58 58 0 0 1 134 82 L134 90 L18 90 Z" />

        {minorTicks.map((tickRatio) => {
          const outer = getArcPoint(tickRatio, TICK_RADIUS_OUTER)
          const inner = getArcPoint(tickRatio, TICK_RADIUS_INNER)
          const isMajor = Math.round(tickRatio * 30) % 5 === 0

          return (
            <line
              className={isMajor ? 'lab-meter__tick lab-meter__tick--major' : 'lab-meter__tick'}
              key={tickRatio}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
          )
        })}

        {scaleLabels[type].map((label, index, labels) => {
          const labelPoint = getArcPoint(index / (labels.length - 1), LABEL_RADIUS)

          return (
            <text
              className="lab-meter__scale-label"
              dominantBaseline="middle"
              key={label}
              textAnchor="middle"
              x={labelPoint.x}
              y={labelPoint.y}
            >
              {label}
            </text>
          )
        })}

        <line
          className="lab-meter__needle"
          transform={`rotate(${meterDisplay.rotation} ${DIAL_CENTER.x} ${DIAL_CENTER.y})`}
          x1={DIAL_CENTER.x}
          x2={DIAL_CENTER.x}
          y1={DIAL_CENTER.y}
          y2={DIAL_CENTER.y - NEEDLE_RADIUS}
        />
        <circle className="lab-meter__needle-hub" cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} r="2.5" />
      </svg>

      <div className="lab-meter__center-label">{centerLabel}</div>
      <div className="lab-meter__unit">{unit}</div>

      {terminals.map((terminal) => (
        <ApparatusTerminal
          key={terminal.number}
          number={terminal.number}
          owner={terminalOwner}
          polarity={terminal.polarity}
          variant={type}
        />
      ))}
    </article>
  )
}

export default AnalogMeter
