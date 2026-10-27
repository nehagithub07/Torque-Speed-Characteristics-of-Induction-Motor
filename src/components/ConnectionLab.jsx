import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import EquipmentPanel from './EquipmentPanel.jsx'
import {
  CONNECTION_ENDPOINTS_BY_ID, CURRENT_PROBES, TERMINALS, TERMINALS_BY_ID, getConnectionLabel,
} from '../config/circuitConnections.js'
import {
  createDefaultConnections,
  getConnectedCurrentProbes,
  getCurrentProbePaths,
  getCurrentProbePosition,
  getProbeConnection,
  getWirePath,
  hasConnectionBetween,
  isRequiredConnection,
  removeConnectionsFromTerminal,
  validateConnections,
} from '../utils/circuitWiring.js'

const ConnectionLab = ({
  activeGuideConnection,
  autoConnectRequest,
  checkRequest,
  connectionsLocked = false,
  highlightedTerminalIds = [],
  onCheckConnections,
  onAutoConnectReady,
  onConnectionRemovalBlocked,
  onGuideConnectionComplete,
  onValidateConnectionsReady,
  onWiringChange,
  onWrongConnectionMade,
  powerOn,
  scale,
  onTogglePower,
  onVoltageControlBlocked,
  setVoltage,
  voltage,
  loadLevel, turning, canIncreaseLoad, readingsReady, reading,
  onIncreaseLoad, onTurningChange, loadHint,
}) => {
  const labRef = useRef(null)
  const connectionsRef = useRef([])
  const lockedRef = useRef(false)
  const callbacksRef = useRef({})
  const dragRef = useRef(null)
  const selectedRef = useRef(null)
  const connectionCounterRef = useRef(0)
  const [connections, setConnections] = useState([])
  const [selectedTerminal, setSelectedTerminal] = useState(null)
  const [draft, setDraft] = useState(null)
  const [geometry, setGeometry] = useState({ width: 845, height: 747, terminals: {} })
  const currentProbes = getConnectedCurrentProbes(connections)
  const availableProbeTargets = CURRENT_PROBES.filter(({ wire }) => hasConnectionBetween(connections, ...wire))
  const endpointPositions = { ...geometry.terminals }
  availableProbeTargets.forEach(({ targetId, wire, phase }) => {
    endpointPositions[targetId] = getCurrentProbePosition(geometry.terminals[wire[0]], geometry.terminals[wire[1]], phase)
  })

  useEffect(() => {
    lockedRef.current = connectionsLocked || powerOn
    callbacksRef.current = {
      onCheckConnections, onConnectionRemovalBlocked, onGuideConnectionComplete,
      onWiringChange, onWrongConnectionMade,
    }
  }, [connectionsLocked, powerOn, onCheckConnections, onConnectionRemovalBlocked,
    onGuideConnectionComplete, onWiringChange, onWrongConnectionMade])

  const commitConnections = useCallback(nextConnections => {
    connectionsRef.current = nextConnections
    setConnections(nextConnections)
  }, [])

  const clearSelection = useCallback(() => {
    selectedRef.current = null
    dragRef.current = null
    setSelectedTerminal(null)
    setDraft(null)
  }, [])

  const addConnection = useCallback((sourceId, targetId) => {
    if (lockedRef.current || sourceId === targetId) return
    if (!CONNECTION_ENDPOINTS_BY_ID[sourceId] || !CONNECTION_ENDPOINTS_BY_ID[targetId]) return

    const existingConnections = connectionsRef.current
    const probe = getProbeConnection(sourceId, targetId)
    if (probe && (!CURRENT_PROBES.some(item => item.terminalId === probe.terminalId)
      || !hasConnectionBetween(existingConnections, ...probe.wire))) {
      callbacksRef.current.onWrongConnectionMade?.()
      clearSelection()
      return
    }
    const wrong = !isRequiredConnection(sourceId, targetId)
      || hasConnectionBetween(existingConnections, sourceId, targetId)
    connectionCounterRef.current += 1
    commitConnections([...existingConnections, {
      id: `connection-${sourceId}-${targetId}-${connectionCounterRef.current}`,
      sourceId,
      targetId,
    }])
    if (wrong) callbacksRef.current.onWrongConnectionMade?.()
    clearSelection()
  }, [clearSelection, commitConnections])

  const selectTerminal = useCallback(terminalId => {
    if (lockedRef.current) return
    if (selectedRef.current && selectedRef.current !== terminalId) {
      addConnection(selectedRef.current, terminalId)
    } else {
      const nextSelection = selectedRef.current === terminalId ? null : terminalId
      selectedRef.current = nextSelection
      setSelectedTerminal(nextSelection)
    }
  }, [addConnection])

  const autoConnectCircuit = useCallback(() => {
    lockedRef.current = true
    clearSelection()
    commitConnections(createDefaultConnections())
  }, [clearSelection, commitConnections])

  useEffect(() => {
    onAutoConnectReady?.(autoConnectCircuit)
    onValidateConnectionsReady?.(() => validateConnections(connectionsRef.current))
    return () => {
      onAutoConnectReady?.(null)
      onValidateConnectionsReady?.(null)
    }
  }, [autoConnectCircuit, onAutoConnectReady, onValidateConnectionsReady])

  useEffect(() => {
    callbacksRef.current.onWiringChange?.(validateConnections(connections))
    if (activeGuideConnection?.length
      && hasConnectionBetween(connections, ...activeGuideConnection)) {
      callbacksRef.current.onGuideConnectionComplete?.(activeGuideConnection)
    }
  }, [activeGuideConnection, connections])

  useEffect(() => {
    if (!autoConnectRequest) return undefined
    const frame = requestAnimationFrame(autoConnectCircuit)
    return () => cancelAnimationFrame(frame)
  }, [autoConnectCircuit, autoConnectRequest])

  useEffect(() => {
    if (checkRequest) callbacksRef.current.onCheckConnections?.(validateConnections(connectionsRef.current))
  }, [checkRequest])

  // Use measured terminal centers so wires follow the scaled apparatus exactly.
  useLayoutEffect(() => {
    const lab = labRef.current
    if (!lab) return undefined
    let frame
    const refreshGeometry = () => {
      const bounds = lab.getBoundingClientRect()
      const scaleX = bounds.width / lab.offsetWidth || 1
      const scaleY = bounds.height / lab.offsetHeight || 1
      const terminals = {}
      TERMINALS.forEach(({ id }) => {
        const element = document.getElementById(id)
        if (!element) return
        const rect = element.getBoundingClientRect()
        terminals[id] = {
          x: (rect.left + rect.width / 2 - bounds.left) / scaleX,
          y: (rect.top + rect.height / 2 - bounds.top) / scaleY,
        }
      })
      const next = { width: lab.offsetWidth, height: lab.offsetHeight, terminals }
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const scheduleRefresh = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(refreshGeometry)
    }
    const observer = new ResizeObserver(scheduleRefresh)
    observer.observe(lab)
    lab.querySelectorAll('article').forEach(element => observer.observe(element))
    lab.addEventListener('load', scheduleRefresh, true)
    window.addEventListener('resize', scheduleRefresh)
    scheduleRefresh()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      lab.removeEventListener('load', scheduleRefresh, true)
      window.removeEventListener('resize', scheduleRefresh)
    }
  }, [scale])

  useEffect(() => {
    const connected = new Set(connections.flatMap(({ sourceId, targetId }) => [sourceId, targetId]))
    const highlighted = new Set(highlightedTerminalIds)
    labRef.current?.querySelectorAll('[data-terminal-id]').forEach(element => {
      const id = element.dataset.terminalId
      element.classList.toggle('terminal-connected', connected.has(id))
      element.classList.toggle('terminal-selected', id === selectedTerminal)
      element.classList.toggle('simulation-guide-highlight', highlighted.has(id))
      if (element.classList.contains('connection-terminal')) {
        element.setAttribute('aria-pressed', String(id === selectedTerminal))
        element.setAttribute('aria-disabled', String(element.disabled || connectionsLocked || powerOn))
      }
    })
  }, [connections, connectionsLocked, highlightedTerminalIds, powerOn, selectedTerminal])

  const localPoint = useCallback(event => {
    const lab = labRef.current
    const bounds = lab.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * lab.offsetWidth / bounds.width,
      y: (event.clientY - bounds.top) * lab.offsetHeight / bounds.height,
    }
  }, [])

  useEffect(() => {
    const move = event => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true
      setDraft({ sourceId: drag.sourceId, target: localPoint(event) })
    }
    const finish = event => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const target = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest('.connection-terminal[data-terminal-id]')
      dragRef.current = null
      setDraft(null)
      if (target && !target.disabled && target.dataset.terminalId !== drag.sourceId) {
        addConnection(drag.sourceId, target.dataset.terminalId)
      } else if (!drag.moved && target) {
        selectTerminal(drag.sourceId)
      }
    }
    const cancel = () => clearSelection()
    const escape = event => { if (event.key === 'Escape') clearSelection() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', escape)
    }
  }, [addConnection, clearSelection, localPoint, selectTerminal])

  const handlePointerDown = event => {
    const terminal = event.target.closest('.connection-terminal[data-terminal-id]')
    if (!terminal || terminal.disabled || event.button !== 0 || lockedRef.current) return
    event.preventDefault()
    terminal.focus()
    dragRef.current = {
      sourceId: terminal.dataset.terminalId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    }
    setDraft({ sourceId: terminal.dataset.terminalId, target: localPoint(event) })
  }

  const handleClick = event => {
    const label = event.target.closest('.terminal-number-label[data-terminal-id]')
    if (label) {
      if (lockedRef.current) {
        callbacksRef.current.onConnectionRemovalBlocked?.()
        return
      }
      const id = label.dataset.terminalId
      commitConnections(removeConnectionsFromTerminal(connectionsRef.current, id))
      clearSelection()
      return
    }
    // Keyboard and assistive-technology activation has no pointer sequence.
    const terminal = event.target.closest('.connection-terminal[data-terminal-id]')
    if (terminal && !terminal.disabled && event.detail === 0) selectTerminal(terminal.dataset.terminalId)
  }

  const visibleDraft = connectionsLocked || powerOn ? null : draft
  return (
    <div
      className={`connection-lab ${connectionsLocked ? 'connection-lab--locked' : ''}`}
      id="connection-lab"
      ref={labRef}
      aria-label="Experiment apparatus area"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <EquipmentPanel
        onTogglePower={onTogglePower}
        onVoltageControlBlocked={onVoltageControlBlocked}
        powerOn={powerOn}
        setVoltage={setVoltage}
        voltage={voltage}
        loadLevel={loadLevel} turning={turning} canIncreaseLoad={canIncreaseLoad}
        readingsReady={readingsReady} reading={reading}
        onIncreaseLoad={onIncreaseLoad} onTurningChange={onTurningChange} loadHint={loadHint}
      />
      <svg
        id="circuit-wires"
        className="circuit-wires"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {connections.filter(({ sourceId, targetId }) => !getProbeConnection(sourceId, targetId)).map(({ id, sourceId, targetId }) => (
          <path
            key={id}
            id={id}
            className={`circuit-wire wire-${getConnectionLabel(sourceId, targetId)}`}
            data-source-terminal={sourceId}
            data-target-terminal={targetId}
            data-connection={getConnectionLabel(sourceId, targetId)}
            d={getWirePath(geometry.terminals[sourceId], geometry.terminals[targetId],
              sourceId.startsWith('mcb-') || targetId.startsWith('mcb-'))}
            stroke={TERMINALS_BY_ID[sourceId].color}
          />
        ))}
        {currentProbes.map(({ id, terminalId, wire, phase }) => {
          const { lead, loop } = getCurrentProbePaths(
            geometry.terminals[terminalId], geometry.terminals[wire[0]],
            geometry.terminals[wire[1]], phase, geometry.width,
          )
          return (
            <g
              key={id}
              className="current-probe"
              stroke={TERMINALS_BY_ID[terminalId].color}
              data-probe-terminal={terminalId}
              data-clamped-wire={getConnectionLabel(...wire)}
            >
              <path className="circuit-wire current-probe__lead" d={lead} />
              <path className="circuit-wire current-probe__loop" d={loop} />
            </g>
          )
        })}
        {visibleDraft && (
          <path
            id="connection-preview"
            className="circuit-wire circuit-wire--preview"
            d={getWirePath(endpointPositions[visibleDraft.sourceId], visibleDraft.target)}
            stroke={CONNECTION_ENDPOINTS_BY_ID[visibleDraft.sourceId].color}
          />
        )}
      </svg>
      {availableProbeTargets.map(({ targetId, wireLabel, color }) => {
        const position = endpointPositions[targetId]
        if (!position) return null
        return (
          <button
            key={targetId}
            id={targetId}
            className="connection-terminal current-probe-target"
            data-terminal-id={targetId}
            style={{ left: position.x, top: position.y, '--terminal-color': color }}
            type="button"
            aria-label={`Loop target on motor wire ${wireLabel}. Select this target and an analyser port to connect a current loop.`}
            title={`Connect a current loop to motor wire ${wireLabel}`}
          />
        )
      })}
    </div>
  )
}

export default ConnectionLab
