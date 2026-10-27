import { CURRENT_PROBES, TERMINALS_BY_NUMBER, getConnectionLabel } from '../config/circuitConnections.js'

const ApparatusTerminal = ({ number }) => {
  const terminal = TERMINALS_BY_NUMBER[number]
  if (!terminal) return null
  const probe = CURRENT_PROBES.find(({ terminalId }) => terminalId === terminal.id)
  const probeDescription = probe
    ? `${terminal.name}. Drag to the loop target on motor wire ${getConnectionLabel(...probe.wire)}, or select this port and then the loop target.`
    : null

  return (
    <div
      id={`${terminal.id}-assembly`}
      className={`apparatus-terminal ${terminal.group}-terminal-assembly`}
      style={{ '--terminal-color': terminal.color }}
    >
      <button
        id={terminal.id}
        className={`connection-terminal ${terminal.group}-terminal ${terminal.id}`}
        data-terminal-id={terminal.id}
        data-terminal-number={number}
        aria-label={probeDescription ?? `${terminal.name}. Drag to another terminal or select two terminals to connect.`}
        title={probeDescription ?? terminal.name}
        type="button"
      />
      <button
        id={`${terminal.id}-label`}
        className={`terminal-number-label ${terminal.group}-terminal-label`}
        data-terminal-id={terminal.id}
        aria-label={`Remove connections from ${terminal.name}`}
        title={`${terminal.name} — select number to remove its connections`}
        type="button"
      >
        {number}
      </button>
    </div>
  )
}

export default ApparatusTerminal
