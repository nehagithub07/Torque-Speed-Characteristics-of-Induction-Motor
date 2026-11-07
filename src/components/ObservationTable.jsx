import SectionCard from './SectionCard.jsx'
import { MOTOR_LOAD_READINGS, OBSERVATION_COLUMNS } from '../utils/motorLoadReadings.js'

const ObservationTable = ({ observations }) => (
  <SectionCard className="motor-observation-card" icon="table" id="observation-table-panel" title="OBSERVATION TABLE">
    <div className="observation-table-wrap">
      <table className="observation-table motor-observation-table" aria-label="Three-phase motor load test observations">
        <thead>
          <tr>{OBSERVATION_COLUMNS.map(({ key, label, subscript, unit }) => (
            <th key={key} scope="col">{label}{subscript && <sub>{subscript}</sub>}{unit && <small>({unit})</small>}</th>
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
    <p className="observation-table-note">
  <strong>Note:</strong> V<sub>R</sub>, V<sub>Y</sub> and V<sub>B</sub> represent the phase voltages, while I<sub>R</sub>, I<sub>Y</sub> and I<sub>B</sub> represent the corresponding phase currents. The line voltage of the three-phase supply is 400 V.
</p>
  </SectionCard>
)

export default ObservationTable
