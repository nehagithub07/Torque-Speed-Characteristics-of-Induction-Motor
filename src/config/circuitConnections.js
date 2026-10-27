// Terminal numbers, readable DOM IDs, and required wiring live in one place.
export const TERMINAL_GROUPS = [
  { id: 'mcb', name: 'MCB', numbers: [1, 2, 3] },
  { id: 'autotransformer-input', name: 'Autotransformer input', numbers: [4, 5, 6] },
  { id: 'autotransformer-output', name: 'Autotransformer output', numbers: [7, 8, 9] },
  { id: 'power-analyser', name: 'Power analyser', numbers: [10, 11, 12, 13, 14, 15] },
  { id: 'pulley', name: 'Pulley', numbers: [16, 17, 18] },
]

export const TERMINAL_COLORS = ['#c9322c', '#bf8b08', '#2463c9']

export const TERMINALS = TERMINAL_GROUPS.flatMap(group => (
  group.numbers.map((number, index) => ({
    id: `${group.id}-terminal-${number}`,
    number,
    group: group.id,
    name: `${group.name} terminal ${number}`,
    color: TERMINAL_COLORS[index % TERMINAL_COLORS.length],
  }))
))

export const TERMINALS_BY_NUMBER = Object.fromEntries(TERMINALS.map(terminal => [terminal.number, terminal]))
export const TERMINALS_BY_ID = Object.fromEntries(TERMINALS.map(terminal => [terminal.id, terminal]))
export const getTerminalNumber = id => TERMINALS_BY_ID[id]?.number

export const REQUIRED_CONNECTION_PAIRS = [
  [1, 4], [2, 5], [3, 6],
  [7, 10], [8, 11], [9, 12],
  [7, 16], [8, 17], [9, 18],
]

export const REQUIRED_TERMINAL_CONNECTIONS = REQUIRED_CONNECTION_PAIRS.map(pair => (
  pair.map(number => TERMINALS_BY_NUMBER[number].id)
))

// Current probes wrap around a motor conductor instead of joining two ports.
export const CURRENT_PROBES = [
  { number: 13, wire: [7, 16] },
  { number: 14, wire: [8, 17] },
  { number: 15, wire: [9, 18] },
].map(({ number, wire }, phase) => ({
  terminalId: TERMINALS_BY_NUMBER[number].id,
  targetId: `motor-wire-${wire.join('-')}`,
  wire: wire.map(terminal => TERMINALS_BY_NUMBER[terminal].id),
  wireLabel: wire.join('-'),
  color: TERMINAL_COLORS[phase],
  phase,
}))

export const CURRENT_PROBES_BY_TARGET_ID = Object.fromEntries(
  CURRENT_PROBES.map(probe => [probe.targetId, probe]),
)

export const CONNECTION_ENDPOINTS_BY_ID = {
  ...TERMINALS_BY_ID,
  ...Object.fromEntries(CURRENT_PROBES.map(probe => [probe.targetId, {
    id: probe.targetId,
    color: probe.color,
    name: `Loop on motor wire ${probe.wireLabel}`,
  }])),
}

export const REQUIRED_CONNECTIONS = [
  ...REQUIRED_TERMINAL_CONNECTIONS,
  ...CURRENT_PROBES.map(({ terminalId, targetId }) => [terminalId, targetId]),
]

export const getConnectionLabel = (sourceId, targetId) => {
  const probe = CURRENT_PROBES_BY_TARGET_ID[sourceId] ?? CURRENT_PROBES_BY_TARGET_ID[targetId]
  if (probe) {
    const terminalId = sourceId === probe.targetId ? targetId : sourceId
    return `${getTerminalNumber(terminalId)} → loop on ${probe.wireLabel}`
  }
  return `${getTerminalNumber(sourceId)}-${getTerminalNumber(targetId)}`
}

export const getConnectionInstruction = (sourceId, targetId) => {
  const probe = CURRENT_PROBES_BY_TARGET_ID[sourceId] ?? CURRENT_PROBES_BY_TARGET_ID[targetId]
  if (probe) {
    const terminalId = sourceId === probe.targetId ? targetId : sourceId
    return `Connect terminal ${getTerminalNumber(terminalId)} to the loop target on motor wire ${probe.wireLabel}.`
  }
  return `Connect terminal ${getTerminalNumber(sourceId)} to terminal ${getTerminalNumber(targetId)}.`
}
