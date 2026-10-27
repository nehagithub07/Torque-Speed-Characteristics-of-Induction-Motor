import mcbOffImg from '../assets/mcb_off.png'
import mcbOnImg from '../assets/mcb_on.png'
import ApparatusTerminal from './ApparatusTerminal.jsx'

const PowerSupply = ({ onTogglePower, powerOn }) => {
  const mcbImg = powerOn ? mcbOnImg : mcbOffImg

  return (
    <article className={`mcb-device mcb-device--${powerOn ? 'on' : 'off'}`} id="power-supply" aria-label="MCB">
      <img
        alt={powerOn ? 'MCB on' : 'MCB off'}
        className="mcb-device__image"
        src={mcbImg}
      />

      {[1, 2, 3].map(number => <ApparatusTerminal key={number} number={number} />)}

      <button
        id="power-toggle-button"
        aria-label={powerOn ? 'MCB is locked on' : 'Switch MCB on'}
        aria-pressed={powerOn}
        className="mcb-device__button"
        disabled={powerOn}
        onClick={onTogglePower}
        type="button"
      />
    </article>
  )
}

export default PowerSupply
