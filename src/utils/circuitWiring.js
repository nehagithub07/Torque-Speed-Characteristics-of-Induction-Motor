import { CURRENT_PROBES_BY_TARGET_ID, REQUIRED_CONNECTIONS, getConnectionLabel } from '../config/circuitConnections.js'

export const getConnectionKey = (sourceId, targetId) => [sourceId, targetId].sort().join('|')

const requiredKeys = new Set(REQUIRED_CONNECTIONS.map(pair => getConnectionKey(...pair)))

export const isRequiredConnection = (sourceId, targetId) => requiredKeys.has(getConnectionKey(sourceId, targetId))

export const hasConnectionBetween = (connections, sourceId, targetId) => (
  connections.some(connection => getConnectionKey(connection.sourceId, connection.targetId) === getConnectionKey(sourceId, targetId))
)

export const getProbeConnection = (sourceId, targetId) => {
  const probe = CURRENT_PROBES_BY_TARGET_ID[sourceId] ?? CURRENT_PROBES_BY_TARGET_ID[targetId]
  return probe ? { ...probe, terminalId: sourceId === probe.targetId ? targetId : sourceId } : null
}

export const getConnectedCurrentProbes = connections => connections.flatMap(({ id, sourceId, targetId }) => {
  const probe = getProbeConnection(sourceId, targetId)
  return probe && hasConnectionBetween(connections, ...probe.wire) ? [{ ...probe, id }] : []
})

export const removeConnectionsFromTerminal = (connections, terminalId) => {
  const remaining = connections.filter(({ sourceId, targetId }) => sourceId !== terminalId && targetId !== terminalId)
  return remaining.filter(({ sourceId, targetId }) => {
    const probe = getProbeConnection(sourceId, targetId)
    return !probe || hasConnectionBetween(remaining, ...probe.wire)
  })
}

export const createDefaultConnections = () => REQUIRED_CONNECTIONS.map(([sourceId, targetId]) => ({
  id: `connection-${sourceId}-${targetId}`,
  sourceId,
  targetId,
}))

export const validateConnections = (connections) => {
  const matchedKeys = new Set()
  const wrongConnections = []

  connections.forEach(({ sourceId, targetId }) => {
    const key = getConnectionKey(sourceId, targetId)
    const detail = {
      firstTerminal: sourceId,
      secondTerminal: targetId,
      label: getConnectionLabel(sourceId, targetId),
    }

    const probe = getProbeConnection(sourceId, targetId)
    if (!requiredKeys.has(key) || (probe && !hasConnectionBetween(connections, ...probe.wire))) {
      wrongConnections.push(detail)
    } else if (matchedKeys.has(key)) {
      wrongConnections.push({ ...detail, duplicate: true })
    } else {
      matchedKeys.add(key)
    }
  })

  const missingConnections = REQUIRED_CONNECTIONS
    .filter(pair => !matchedKeys.has(getConnectionKey(...pair)))
    .map(([firstTerminal, secondTerminal]) => ({
      firstTerminal,
      secondTerminal,
      label: getConnectionLabel(firstTerminal, secondTerminal),
    }))

  return {
    isCorrect: missingConnections.length === 0 && wrongConnections.length === 0,
    matchedCount: matchedKeys.size,
    missingConnections,
    totalConnections: connections.length,
    wrongConnections,
  }
}

export const getWirePath = (source, target, vertical = false) => {
  if (!source || !target) return ''

  const distance = vertical ? Math.abs(target.y - source.y) : Math.abs(target.x - source.x)
  const bend = Math.max(40, Math.min(distance * 0.55, 160))
  const direction = vertical ? Math.sign(target.y - source.y) : Math.sign(target.x - source.x)

  return vertical
    ? `M ${source.x} ${source.y} C ${source.x} ${source.y + bend * direction}, ${target.x} ${target.y - bend * direction}, ${target.x} ${target.y}`
    : `M ${source.x} ${source.y} C ${source.x + bend * direction} ${source.y}, ${target.x - bend * direction} ${target.y}, ${target.x} ${target.y}`
}

export const getCurrentProbePosition = (wireStart, wireEnd, phase) => {
  if (!wireStart || !wireEnd) return null
  // Sample the same cubic as the motor wire so the circular probe stays centered
  // on its conductor, including after resizing or reverse-direction wiring.
  const t = [0.5, 0.45, 0.2][phase]
  const u = 1 - t
  const bend = Math.max(40, Math.min(Math.abs(wireEnd.x - wireStart.x) * 0.55, 160))
  const direction = Math.sign(wireEnd.x - wireStart.x)
  const x = u ** 3 * wireStart.x
    + 3 * u ** 2 * t * (wireStart.x + bend * direction)
    + 3 * u * t ** 2 * (wireEnd.x - bend * direction)
    + t ** 3 * wireEnd.x
  const y = (u ** 3 + 3 * u ** 2 * t) * wireStart.y
    + (3 * u * t ** 2 + t ** 3) * wireEnd.y
  return { x, y }
}

export const getCurrentProbePaths = (source, wireStart, wireEnd, phase, width) => {
  const position = getCurrentProbePosition(wireStart, wireEnd, phase)
  if (!source || !position) return { lead: '', loop: '' }
  const { x, y } = position

  const radius = 12
  const right = width - 18 - phase * 22
  const turnY = source.y + (y - source.y) * 0.48
  const angle = [Math.PI * 0.65, Math.PI * 0.15, -Math.PI / 2][phase]
  const endX = x + Math.cos(angle) * radius
  const endY = y + Math.sin(angle) * radius
  const sweepY = y + [56, 15, -95][phase]

  return {
    lead: `M ${source.x} ${source.y} C ${right} ${source.y}, ${right} ${source.y + 65}, ${right} ${turnY} C ${right} ${sweepY}, ${x + 95} ${sweepY}, ${endX} ${endY}`,
    loop: `M ${x + radius} ${y} A ${radius} ${radius} 0 1 0 ${x - radius} ${y} A ${radius} ${radius} 0 1 0 ${x + radius} ${y}`,
  }
}
