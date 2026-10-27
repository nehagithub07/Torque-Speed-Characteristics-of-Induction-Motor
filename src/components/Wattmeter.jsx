import bulbOffImg from '../assets/bulboff.png'
import bulbOnImg from '../assets/bulbon.png'
import lampLoadImg from '../assets/lampload.png'
import switchOffImg from '../assets/switchoff.png'
import switchOnImg from '../assets/switchon.png'
import wattmeterImg from '../assets/ac_wattmeter.png'
import { wattmeterNeedleRotation } from '../config/meterNeedleRotations.js'
import useMeterDisplay from '../hooks/useMeterDisplay.js'
import ApparatusTerminal from './ApparatusTerminal.jsx'
import MeterNeedle from './MeterNeedle.jsx'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const LAMP_LOAD_BULB_Y_OFFSET = -5

const LAMP_LOAD_BULBS = [
  { id: 'r1-c1', row: 1, x: 23.5, y: 30.5 },
  { id: 'r1-c2', row: 1, x: 36.5, y: 30.5 },
  { id: 'r1-c3', row: 1, x: 49.5, y: 30.5 },
  { id: 'r1-c4', row: 1, x: 62.5, y: 30.5 },
  { id: 'r2-c1', row: 2, x: 23.5, y: 44.2 },
  { id: 'r2-c2', row: 2, x: 36.5, y: 44.2 },
  { id: 'r2-c3', row: 2, x: 49.5, y: 44.2 },
  { id: 'r2-c4', row: 2, x: 62.5, y: 44.2 },
  { id: 'r3-c1', row: 3, x: 23.5, y: 57.9 },
  { id: 'r3-c2', row: 3, x: 36.5, y: 57.9 },
  { id: 'r3-c3', row: 3, x: 49.5, y: 57.9 },
  { id: 'r3-c4', row: 3, x: 62.5, y: 57.9 },
  { id: 'r4-c1', row: 4, x: 23.5, y: 71.6 },
  { id: 'r4-c2', row: 4, x: 36.5, y: 71.6 },
  { id: 'r4-c3', row: 4, x: 49.5, y: 71.6 },
  { id: 'r4-c4', row: 4, x: 62.5, y: 71.6 },
]

const LAMP_LOAD_SWITCHES = [
  { id: 'switch-1', row: 1 },
  { id: 'switch-2', row: 2 },
  { id: 'switch-3', row: 3 },
  { id: 'switch-4', row: 4 },
]

const WATTMETER_TERMINAL_LABELS = [
  { id: 'main', label: 'M' },
  { id: 'line', label: 'L' },
  { id: 'common', label: 'C' },
  { id: 'voltage', label: 'V' },
]

const formatCssLength = (value, unit) => (
  typeof value === 'number' ? `${value}${unit}` : value
)

const getBulbStyle = ({ rotation, scale, width, x, y }) => {
  const style = {
    '--bulb-x': `${x}%`,
    '--bulb-y': `${y + LAMP_LOAD_BULB_Y_OFFSET}%`,
  }

  if (width) {
    style['--bulb-width'] = formatCssLength(width, '%')
  }

  if (rotation) {
    style['--bulb-rotation'] = formatCssLength(rotation, 'deg')
  }

  if (scale) {
    style['--bulb-scale'] = scale
  }

  return style
}

const Wattmeter = ({
  activeLoadLevel = 0,
  autotransformerSet = false,
  nextEnabledLoadLevel = 0,
  onLoadLevelChange,
  value = 0,
}) => {
  const numericValue = Number.isFinite(value) ? value : 0
  const meterDisplay = useMeterDisplay(numericValue, wattmeterNeedleRotation)
  const loadLevel = clamp(Math.trunc(Number(activeLoadLevel) || 0), 0, LAMP_LOAD_SWITCHES.length)
  const isRowActive = (row) => row <= loadLevel
  const isSwitchEnabled = (row) => autotransformerSet && row === nextEnabledLoadLevel

  const handleSwitchClick = (row) => {
    if (!isSwitchEnabled(row)) {
      return
    }

    onLoadLevelChange?.(row)
  }

  return (
    <article className="lab-meter lab-meter--wattmeter" id="wattmeter-meter" aria-label="AC wattmeter">
      <span className="lab-meter__image-frame">
        <img alt="AC wattmeter" className="lab-meter__image" src={wattmeterImg} />
      </span>
      <div className="wattmeter-terminal-labels" aria-hidden="true">
        {WATTMETER_TERMINAL_LABELS.map(({ id, label }) => (
          <span className={`wattmeter-terminal-label wattmeter-terminal-label--${id}`} key={id}>
            {label}
          </span>
        ))}
      </div>
      <div className="lamp-load" id="lamp-load" role="img" aria-label="Lamp load with 16 bulbs">
        <img alt="" className="lamp-load__image" src={lampLoadImg} aria-hidden="true" />
        {LAMP_LOAD_BULBS.map((bulb) => (
          <span
            className="lamp-load__bulb"
            key={bulb.id}
            style={getBulbStyle(bulb)}
          >
            <img
              alt=""
              className="lamp-load__bulb-image"
              src={isRowActive(bulb.row) ? bulbOnImg : bulbOffImg}
              aria-hidden="true"
            />
          </span>
        ))}
        {LAMP_LOAD_SWITCHES.map((switchItem) => (
          <button
            aria-label={`Set lamp load to ${switchItem.row * 4} bulbs`}
            aria-pressed={isRowActive(switchItem.row)}
            className={`lamp-load__switch lamp-load__switch--${switchItem.row}`}
            disabled={!isSwitchEnabled(switchItem.row)}
            key={switchItem.id}
            onClick={() => handleSwitchClick(switchItem.row)}
            type="button"
          >
            <img
              alt=""
              className="lamp-load__switch-image"
              src={isRowActive(switchItem.row) ? switchOnImg : switchOffImg}
              aria-hidden="true"
            />
          </button>
        ))}
        <ApparatusTerminal number={23} owner="Lamp load" polarity="plus" variant="lamp-load" />
        <ApparatusTerminal number={24} owner="Lamp load" polarity="minus" variant="lamp-load" />
      </div>

      <MeterNeedle className="meter-needle--wattmeter" rotation={meterDisplay.rotation} />

      <ApparatusTerminal number={7} owner="AC wattmeter" polarity="plus" variant="wattmeter" />
      <ApparatusTerminal number={8} owner="AC wattmeter" polarity="plus" variant="wattmeter" />
      <ApparatusTerminal number={9} owner="AC wattmeter" polarity="plus" variant="wattmeter" />
      <ApparatusTerminal number={10} owner="AC wattmeter" polarity="minus" variant="wattmeter" />
    </article>
  )
}

export default Wattmeter
