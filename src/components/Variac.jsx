import knobImg from '../assets/knob-transformer.png'
import variacImg from '../assets/Vintage Autotransformer Control Panel.png'
import useDampedRotation from '../hooks/useDampedRotation.js'
import ApparatusTerminal from './ApparatusTerminal.jsx'
import './VariacKnob.css'

import { LINE_VOLTAGE } from '../utils/motorLoadReadings.js'

const OUTPUT_VOLTAGE = LINE_VOLTAGE
const MIN_KNOB_ROTATION = -45
const MAX_KNOB_ROTATION = 93

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const Variac = ({ onBlockedControl, powerOn, setVoltage, voltage }) => {
  const handleKnobClick = () => {
    if (!powerOn) {
      onBlockedControl?.()
      return
    }

    setVoltage(OUTPUT_VOLTAGE)
  }

  const voltageRatio = clamp(voltage / OUTPUT_VOLTAGE, 0, 1)
  const rotation = MIN_KNOB_ROTATION + voltageRatio * (MAX_KNOB_ROTATION - MIN_KNOB_ROTATION)
  const displayRotation = useDampedRotation(rotation, {
    damping: 18,
    stiffness: 72,
  })

  return (
    <article className="variac-device" id="autotransformer-device" aria-label="Vintage autotransformer control panel">
      <img
        alt="Vintage autotransformer control panel"
        className="variac-device__image"
        src={variacImg}
      />
      <img
        alt=""
        aria-hidden="true"
        className="variac-device__knob"
        src={knobImg}
        style={{ transform: `rotate(${displayRotation}deg)` }}
      />

      <span className="variac-device__terminal-heading variac-device__terminal-heading--input">INPUT</span>
      <span className="variac-device__terminal-heading variac-device__terminal-heading--output">OUTPUT</span>
      {[4, 5, 6, 7, 8, 9].map(number => <ApparatusTerminal key={number} number={number} />)}

      <button
        aria-label="Set autotransformer to 400 volts line voltage"
        aria-disabled={!powerOn}
        className="variac-device__control"
        id="voltage-control"
        onClick={handleKnobClick}
        type="button"
      >
        <span className="sr-only">Set autotransformer to 400 volts line voltage</span>
      </button>
    </article>
  )
}

export default Variac
