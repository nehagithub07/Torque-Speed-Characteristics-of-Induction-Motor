import SectionCard from './SectionCard.jsx'
import { MOTOR_LOAD_READINGS, OBSERVATION_COLUMNS } from '../utils/motorLoadReadings.js'

const ObservationTable = ({ observations }) => (
  <SectionCard className="motor-observation-card" icon="table" id="observation-table-panel" title="OBSERVATION TABLE">
    <div className="observation-table-wrap">
      <table className="observation-table motor-observation-table" aria-label="Three-phase motor load test observations">
        <thead>
          <tr>{OBSERVATION_COLUMNS.map(({ key, label, unit }) => (
            <th key={key} scope="col">{label}{unit && <small>({unit})</small>}</th>
          ))}</tr>
        </thead>
        <tbody>
          {MOTOR_LOAD_READINGS.map((_, index) => (
            <tr key={index}>{OBSERVATION_COLUMNS.map(({ key }) => (
              <td key={key}>{observations[index]?.[key] ?? ''}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="observation-table-note">VR, VY, VB: phase voltages. IR, IY, IB: phase currents.<br />Three-phase line voltage: <strong>400 V</strong> · Frequency: <strong>50 Hz</strong></p>
  </SectionCard>
)

export default ObservationTable
