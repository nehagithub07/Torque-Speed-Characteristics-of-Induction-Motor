import analyserOffImg from '../assets/off.png'
import analyserOnImg from '../assets/on.png'
import ApparatusTerminal from './ApparatusTerminal.jsx'

const PowerAnalyser = ({ powerOn, reading, readingsReady = false }) => (
  <article className="power-analyser-device" id="power-analyser-device" aria-label="Power analyser">
    <img
      alt={`Power analyser ${powerOn ? 'on' : 'off'}`}
      className="power-analyser-device__image"
      src={powerOn ? analyserOnImg : analyserOffImg}
      draggable={false}
    />
    {powerOn && (
      <div className="power-analyser__display" id="power-analyser-readings" aria-label="Power analyser live readings">
        <div className="power-analyser__frequency">50 Hz</div>
        <table aria-label="Phase RMS voltage, RMS current and total power">
          <thead><tr><th scope="col" /><th scope="col">V<sub>rms</sub></th><th scope="col">A<sub>rms</sub></th><th scope="col">P<sub>total</sub></th></tr></thead>
          <tbody>
            {['R', 'Y', 'B'].map((phase, index) => (
              <tr key={phase}>
                <th scope="row" className={`phase-${phase.toLowerCase()}`}>{phase}</th>
                <td>{readingsReady ? reading[`v${phase.toLowerCase()}`] : '—'}</td>
                <td>{readingsReady ? reading[`i${phase.toLowerCase()}`].toFixed(2) : '—'}</td>
                {index === 0 && <td rowSpan={3} className="power-analyser__total">{readingsReady ? reading.power.toFixed(2) : '—'}<small>kW</small></td>}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="sr-only">Voltage in volts; current in amperes; P total is the combined three-phase power.</span>
      </div>
    )}
    {[10, 11, 12, 13, 14, 15].map(number => <ApparatusTerminal key={number} number={number} />)}
  </article>
)

export default PowerAnalyser
