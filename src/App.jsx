import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import './MotorLoadLab.css'
import ConnectionLab from './components/ConnectionLab.jsx'
import ActionButtons from './components/ActionButtons.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import FormulaSection from './components/FormulaSection.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import ReportControls from './components/ReportControls.jsx'
import ResultsGraphs from './components/ResultsGraphs.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { EXPERIMENT_ALERTS, READING_ADDED_ALERTS } from './alerts/experimentStepAlerts.js'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useSimulationAudioGuide } from './aiGuide/useSimulationAudioGuide.js'
import { CONNECTION_AUDIO_BY_LABEL, SIMULATION_AUDIO, SIMULATION_MESSAGES } from './audio/simulationAudio.js'
import { useQueuedAudioPlayer } from './audio/useQueuedAudioPlayer.js'
// import StatusBar from './components/StatusBar.jsx'
 
import { REQUIRED_CONNECTIONS, getConnectionLabel } from './config/circuitConnections.js'
import { generateMotorReport } from './utils/reportGenerator.js'
import {
  LINE_VOLTAGE,
  MAX_MOTOR_LOAD_LEVEL,
  createMotorObservation,
  getMotorLoadReading,
} from './utils/motorLoadReadings.js'
 
const BASE_WIDTH = 1440
const BASE_HEIGHT = 960
const GRAPH_SECTION_GAP = 28
const RESULTS_GRAPH_SECTION_HEIGHT = 430
const FOOTER_HEIGHT = 40
const CONTENT_HEIGHT = BASE_HEIGHT
  + GRAPH_SECTION_GAP
  + RESULTS_GRAPH_SECTION_HEIGHT
  + FOOTER_HEIGHT
const PANEL_MAX_SCALE = 1
const MAX_OBSERVATIONS = MAX_MOTOR_LOAD_LEVEL + 1
const MIN_GRAPH_READINGS = MAX_OBSERVATIONS
const REQUIRED_CONNECTION_COUNT = REQUIRED_CONNECTIONS.length

const EMPTY_WIRING_PROGRESS = {
  isCorrect: false,
  matchedCount: 0,
  missingConnections: [],
  totalConnections: 0,
  wrongConnections: [],
}

const getWiringProgressSignature = (progress = EMPTY_WIRING_PROGRESS) => (
  [
    progress.isCorrect ? 'correct' : 'pending',
    progress.matchedCount ?? 0,
    progress.totalConnections ?? 0,
    progress.missingConnections?.map((connection) => connection.label).join(',') ?? '',
    progress.wrongConnections?.map((connection) => connection.label).join(',') ?? '',
  ].join('|')
)

const getActiveInstruction = ({
  connectionsVerified,
  graphGenerated,
  normalizedVoltage,
  powerOn,
  wiringProgress,
  readingCount,
  hasDuplicateReading,
  reportGenerated,
}) => {
  if (!connectionsVerified) {
    const totalConnections = wiringProgress?.totalConnections ?? 0
    const activeConnectionPair = wiringProgress?.missingConnections?.[0]?.label
      ?? getConnectionLabel(...REQUIRED_CONNECTIONS[0])

    if (totalConnections >= REQUIRED_CONNECTION_COUNT || wiringProgress?.isCorrect) {
      return {
        connectionPair: null,
        stepId: 'check',
      }
    }

    return {
      connectionPair: activeConnectionPair,
      stepId: 'connections',
    }
  }

  if (!powerOn) {
    return {
      connectionPair: null,
      stepId: 'mcb',
    }
  }

  if (normalizedVoltage < LINE_VOLTAGE) {
    return {
      connectionPair: null,
      stepId: 'voltage',
    }
  }

  if (readingCount >= MAX_OBSERVATIONS) {
    let stepId = 'plot'
    if (graphGenerated) stepId = 'report'
    if (reportGenerated) stepId = 'print'
    return {
      connectionPair: null,
      stepId,
    }
  }

  return {
    connectionPair: null,
    stepId: readingCount > 1 ? 'repeat' : hasDuplicateReading ? 'load' : 'add',
  }
}

const CONNECTIONS_PER_ALERT_LINE = 6

const formatConnectionList = (connections) => {
  const labels = connections.map((connection) => connection.label)

  if (labels.length <= 1) {
    return labels.join(', ')
  }

  const groupedLabels = []

  for (let index = 0; index < labels.length; index += CONNECTIONS_PER_ALERT_LINE) {
    groupedLabels.push(
      labels
        .slice(index, index + CONNECTIONS_PER_ALERT_LINE)
        .map((label) => `(${label})`)
        .join(', '),
    )
  }

  return groupedLabels.join('\n')
}

const getConnectionDescriptionLine = (connections) => (
  `${formatConnectionList(connections)}.`
)

const getWrongConnectionDescription = ({ missingConnections = [], wrongConnections = [] }) => {
  const alertParts = [getConnectionDescriptionLine(wrongConnections)]

  if (missingConnections.length > 0) {
    alertParts.push(`Missing connections:\n${formatConnectionList(missingConnections)}.`)
  }

  return alertParts.join('\n\n')
}

const getMissingConnectionDescription = ({ missingConnections = [] }) => (
  getConnectionDescriptionLine(missingConnections)
)

const getConnectionResultAudio = ({ missingConnections = [], wrongConnections = [] }) => {
  const totalErrors = wrongConnections.length > 0
    ? wrongConnections.length
    : missingConnections.length

  if (totalErrors <= 1) {
    return SIMULATION_AUDIO.wrongConnection
  }

  return SIMULATION_AUDIO.multipleWrongConnections
}

const getCheckResultAudio = (result) => {
  if (result.isCorrect) {
    return SIMULATION_AUDIO.forCorrectConnectionsCheckClick
  }

  if (result.totalConnections === 0) {
    return SIMULATION_AUDIO.firstCheckClick
  }

  if (result.wrongConnections?.length > 0 || result.missingConnections?.length > 0) {
    return getConnectionResultAudio(result)
  }

  return SIMULATION_AUDIO.multipleWrongConnections
}

const getScale = (containerWidth) => {
  if (typeof window === 'undefined') {
    return 1
  }

  // The layout viewport keeps browser pinch zoom available for small controls.
  const availableWidth = containerWidth ?? document.documentElement.clientWidth
  return Math.min(Math.max(availableWidth, 1) / BASE_WIDTH, PANEL_MAX_SCALE)
}

const App = () => {
  const { clearAlerts, showStepAlert } = useLabAlerts()
  const {
    play: playSimulationAudio,
    playSequence: playSimulationAudioSequence,
    stop: stopSimulationAudio,
  } = useQueuedAudioPlayer()
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(getScale)
  const [voltage, setVoltage] = useState(0)
  const [powerOn, setPowerOn] = useState(false)
  const [activeLoadLevel, setActiveLoadLevel] = useState(0)
  const [loadTurning, setLoadTurning] = useState(false)
  const [observations, setObservations] = useState([])
  const [graphGenerated, setGraphGenerated] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [status, setStatus] = useState('Connect the circuit and the three current loops, then click CHECK.')

  const [autoConnectRequest, setAutoConnectRequest] = useState(0)
  const [checkRequest, setCheckRequest] = useState(0)
  const [resetRequest, setResetRequest] = useState(0)
  const [connectionsLocked, setConnectionsLocked] = useState(false)
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [sessionStart, setSessionStart] = useState(() => Date.now())
  const [wiringProgress, setWiringProgress] = useState(EMPTY_WIRING_PROGRESS)
  const autotransformerReadyAlertShownRef = useRef(false)
  const autoConnectCircuitRef = useRef(null)
  const validateConnectionsRef = useRef(null)

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const updateScale = () => setScale(getScale(wrapper.clientWidth))
    const observer = new ResizeObserver(updateScale)

    updateScale()
    observer.observe(wrapper)

    return () => observer.disconnect()
  }, [])

  const reading = getMotorLoadReading(activeLoadLevel)

  const normalizedVoltage = Number(voltage.toFixed(1))
  const hasDuplicateReading = observations.some((row) => (
    row.loadLevel === activeLoadLevel
  ))
  const readingCount = observations.length
  const canPlotGraph = readingCount >= MIN_GRAPH_READINGS
  const readingsReady = connectionsVerified && powerOn && normalizedVoltage >= LINE_VOLTAGE
  const canAddReading = readingsReady && !loadTurning
  const canIncreaseLoad = readingsReady && hasDuplicateReading && !loadTurning && activeLoadLevel < MAX_MOTOR_LOAD_LEVEL

  const activeInstruction = useMemo(() => getActiveInstruction({
    connectionsVerified,
    graphGenerated,
    normalizedVoltage,
    powerOn,
    readingCount,
    reportGenerated,
    wiringProgress,
    hasDuplicateReading,
  }), [
    connectionsVerified,
    graphGenerated,
    normalizedVoltage,
    powerOn,
    readingCount,
    reportGenerated,
    wiringProgress,
    hasDuplicateReading,
  ])

  const handleWiringChange = useCallback((nextProgress) => {
    const normalizedProgress = nextProgress ?? EMPTY_WIRING_PROGRESS

    setWiringProgress((currentProgress) => (
      getWiringProgressSignature(currentProgress) === getWiringProgressSignature(normalizedProgress)
        ? currentProgress
        : normalizedProgress
    ))

    if (
      connectionsVerified
      && !powerOn
      && normalizedProgress !== EMPTY_WIRING_PROGRESS
      && !normalizedProgress.isCorrect
    ) {
      setConnectionsVerified(false)
    }
  }, [connectionsVerified, powerOn])

  const handleAiGuideStart = useCallback(() => {
    setStatus('AI Guide narration started.')
  }, [])

  const handleAiGuideFinish = useCallback(() => {
    setStatus(SIMULATION_MESSAGES.allGuideConnectionsComplete)
  }, [])

  const handleAiGuideError = useCallback(() => {
    setStatus('AI Guide narration could not start. Add audio files or use a browser with speech synthesis.')
  }, [])

  const handleAiGuideStop = useCallback(() => {
    setStatus('AI Guide narration stopped.')
  }, [])

  const {
    activeConnection: aiGuideActiveConnection,
    continueExperiment: continueAiGuideExperiment,
    highlightedTerminalIds: aiGuideHighlightedTerminalIds,
    isPlaying: aiGuidePlaying,
    onConnectionComplete: handleAiGuideConnectionComplete,
    playWrongConnectionSequence: playAiGuideWrongConnectionSequence,
    start: startAiGuide,
    stop: stopAiGuide,
  } = useSimulationAudioGuide({
    onError: handleAiGuideError,
    onFinish: handleAiGuideFinish,
    onStart: handleAiGuideStart,
    onStatus: setStatus,
    onStop: handleAiGuideStop,
  })

  const handleAiGuide = useCallback(() => {
    if (aiGuidePlaying) {
      stopAiGuide()
      return
    }

    stopSimulationAudio()
    let prompt = null
    if (connectionsVerified) {
      prompt = EXPERIMENT_ALERTS.connectionsVerified
      if (powerOn) prompt = EXPERIMENT_ALERTS.powerOn
      if (readingsReady) {
        prompt = EXPERIMENT_ALERTS.nextHandClick
        if (activeLoadLevel === 0) prompt = EXPERIMENT_ALERTS.autotransformerReadingsReady
        if (activeLoadLevel === 1) prompt = EXPERIMENT_ALERTS.firstHandClick
        if (hasDuplicateReading) prompt = READING_ADDED_ALERTS[readingCount - 1]
      }
      if (graphGenerated) prompt = EXPERIMENT_ALERTS.graphPlotted
    }

    const completedConnections = wiringProgress.totalConnections > 0
      ? REQUIRED_CONNECTIONS.filter(pair => (
          !wiringProgress.missingConnections.some(connection => connection.label === getConnectionLabel(...pair))
        ))
      : []

    startAiGuide({
      completedConnections,
      narration: prompt ? { audio: prompt.audio, text: prompt.description } : null,
    })
  }, [
    activeLoadLevel, aiGuidePlaying, connectionsVerified, graphGenerated, hasDuplicateReading,
    powerOn, readingCount, readingsReady, startAiGuide, stopAiGuide, stopSimulationAudio, wiringProgress,
  ])

  const recordObservation = () => {
    if (!connectionsVerified) {
      setStatus('Check the circuit connections before adding readings.')
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        description: 'Verify the wiring before storing current readings.',
        target: '#check-button',
        type: 'warning',
      })
      return
    }

    if (!powerOn) {
      setStatus('Switch on the power supply before adding readings.')
      showStepAlert(EXPERIMENT_ALERTS.cannotStartPower, {
        description: 'Switch on the verified power supply before adding readings.',
        target: '#power-toggle-button',
      })
      return
    }

    if (normalizedVoltage < LINE_VOLTAGE) {
      setStatus('Please rotate the autotransformer knob first.')
      showStepAlert(EXPERIMENT_ALERTS.rotateAutotransformerBeforeAdd)
      return
    }

    if (loadTurning) return

    if (hasDuplicateReading) {
      setStatus(SIMULATION_MESSAGES.duplicateReading)
      showStepAlert(EXPERIMENT_ALERTS.readingAlreadyExists)
      return
    }

    if (readingCount >= MAX_OBSERVATIONS) {
      setStatus('All load readings are already recorded. Plot the graph or reset for a new run.')
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: `The observation table already contains the maximum ${MAX_OBSERVATIONS} readings.`,
        title: 'Observation Table Is Full',
      })
      return
    }

    const nextObservationId = (observations.at(-1)?.id ?? 0) + 1
    const nextObservation = createMotorObservation({ id: nextObservationId, loadLevel: activeLoadLevel })
    const nextObservationCount = readingCount + 1
    const readingAddedAlert = READING_ADDED_ALERTS[nextObservationCount - 1]

    setObservations([...observations, nextObservation])
    setGraphGenerated(false)
    setReportGenerated(false)
    setStatus(readingAddedAlert.description ?? 'Reading added to the observation table.')
    showStepAlert(readingAddedAlert)
  }

  const resetSimulation = useCallback(() => {
    stopAiGuide()
    stopSimulationAudio()
    setPowerOn(false)
    setVoltage(0)
    setActiveLoadLevel(0)
    setLoadTurning(false)
    setObservations([])
    setGraphGenerated(false)
    setReportGenerated(false)
    setAutoConnectRequest(0)
    setCheckRequest(0)
    setConnectionsLocked(false)
    setConnectionsVerified(false)
    setWiringProgress(EMPTY_WIRING_PROGRESS)
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now())
    autotransformerReadyAlertShownRef.current = false
    setStatus('The simulation has been reset. You can start again.')
    showStepAlert(EXPERIMENT_ALERTS.simulationReset)
  }, [showStepAlert, stopAiGuide, stopSimulationAudio])

  const handleReset = () => {
    clearAlerts()
    resetSimulation()
  }

  const handlePlot = () => {
    if (!canPlotGraph) {
      const remainingReadings = MIN_GRAPH_READINGS - readingCount

      setGraphGenerated(false)
      setReportGenerated(false)
      setStatus(`Add ${remainingReadings} more reading(s) before plotting the graph.`)
      showStepAlert(EXPERIMENT_ALERTS.insufficientGraphReadings, {
        description: `Add ${remainingReadings} more reading(s) before plotting.`,
      })
      return
    }

    setGraphGenerated(true)
    setReportGenerated(false)
    setStatus('Observation graph plotted from the table readings.')
    showStepAlert(EXPERIMENT_ALERTS.graphPlotted)
  }

  const handlePrint = async () => {
    await playSimulationAudio(SIMULATION_AUDIO.print)
    window.print()
  }

  const handleGenerateReport = () => {
    if (readingCount < MIN_GRAPH_READINGS) {
      const remainingReadings = MIN_GRAPH_READINGS - readingCount

      setStatus(`Add ${remainingReadings} more reading(s) before generating the report.`)
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: `Add ${remainingReadings} more reading(s) before generating a report.`,
        target: '#generate-report-button',
        title: `Report Requires ${MIN_GRAPH_READINGS} Readings`,
      })
      return
    }

    if (!graphGenerated) {
      setStatus('Plot the graph before generating the report.')
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: 'Click the Plot button to generate the graph before generating a report.',
        target: '#plot-button',
        title: 'Plot Graph Before Report',
      })
      return
    }

    setStatus('Your report has been generated successfully. Click OK to view your report.')
    showStepAlert(EXPERIMENT_ALERTS.reportGenerated, {
      onConfirm: () => {
        const generated = generateMotorReport({
          observations,
          sessionStart,
        })

        if (!generated) {
          setStatus('Unable to open the report window.')
          window.alert('Unable to open the report window. Please allow pop-ups and try again.')
          return
        }

        setReportGenerated(true)
        setStatus('Your report has been generated successfully.')
      },
    })
  }

  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(CONTENT_HEIGHT * scale)
  const handleCheckConnections = useCallback((result) => {
    const checkResultAudio = getCheckResultAudio(result)

    if (result.isCorrect) {
      if (aiGuidePlaying) continueAiGuideExperiment()
      setConnectionsLocked(true)
      setConnectionsVerified(true)

      setStatus('Connections Verified successfully. Now turn ON the MCB by clicking the MCB lever.')
      showStepAlert(EXPERIMENT_ALERTS.connectionsVerified)

      return
    }

    setConnectionsVerified(false)

    if (result.totalConnections === 0) {
      setStatus('Please make the connections first.')
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        audio: checkResultAudio,
        type: 'warning',
      })
      return
    }

    if (result.wrongConnections?.length > 0) {
      const description = getWrongConnectionDescription(result)
      const title = result.wrongConnections.length === 1
        ? 'Wrong Connection'
        : 'Wrong Connections'

      setStatus(description)
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        audio: checkResultAudio,
        description,
        target: '#connection-lab',
        title,
      })
      return
    }

    if (result.missingConnections?.length > 0) {
      const description = getMissingConnectionDescription(result)

      setStatus(description)
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        audio: checkResultAudio,
        description,
        target: '#connection-lab',
        title: 'Missing Connections',
        type: 'warning',
      })
      return
    }

    setStatus(
      `Invalid connections. Correct matched points: ${result.matchedCount}; total wires: ${result.totalConnections}.`,
    )
    showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
      audio: checkResultAudio,
      description: `Matched ${result.matchedCount} of ${REQUIRED_CONNECTION_COUNT} required wire pairs from ${result.totalConnections} total wires.`,
    })
  }, [aiGuidePlaying, continueAiGuideExperiment, showStepAlert])

  const handleCheck = () => {
    const validateConnections = validateConnectionsRef.current

    if (validateConnections) {
      handleCheckConnections(validateConnections())
      return
    }

    setCheckRequest((current) => current + 1)
  }

  const handleValidateConnectionsReady = useCallback((validateConnections) => {
    validateConnectionsRef.current = validateConnections
  }, [])

  const handleAutoConnectReady = useCallback((autoConnectCircuit) => {
    autoConnectCircuitRef.current = autoConnectCircuit
  }, [])

  const handleConnectionRemovalBlocked = useCallback(() => {
    setStatus('Connections are locked after autoconnect. Reset the simulation to change the wiring.')
  }, [])

  const expectedManualConnectionPair = (
    activeInstruction.connectionPair
    ?? wiringProgress.missingConnections?.[0]?.label
  )

  const handleWrongConnectionMade = useCallback(async () => {
    const currentManualConnectionAudio = expectedManualConnectionPair
      ? CONNECTION_AUDIO_BY_LABEL[expectedManualConnectionPair]
      : null

    if (aiGuidePlaying) {
      const playedAiGuideSequence = await playAiGuideWrongConnectionSequence()

      if (playedAiGuideSequence) {
        return
      }
    }

    await playSimulationAudioSequence([
      SIMULATION_AUDIO.wrongConnection,
      currentManualConnectionAudio,
    ])
  }, [
    aiGuidePlaying,
    expectedManualConnectionPair,
    playAiGuideWrongConnectionSequence,
    playSimulationAudioSequence,
  ])

  const handleTogglePower = () => {
    if (!powerOn && !connectionsVerified) {
      setStatus('Make and check the connections before turning ON the MCB.')
      showStepAlert(EXPERIMENT_ALERTS.makeConnectionsBeforeMcb)
      return
    }

    if (powerOn) {
      return
    }

    setPowerOn(true)
    setStatus('MCB has been turned ON. Next, click on the autotransformer knob to set the desired voltage.')
    showStepAlert(EXPERIMENT_ALERTS.powerOn)
  }
  const handleAutoConnect = () => {
    const wasAiGuidePlaying = aiGuidePlaying

    if (wasAiGuidePlaying) {
      continueAiGuideExperiment()
    }

    const autoConnectCircuit = autoConnectCircuitRef.current

    if (autoConnectCircuit) {
      autoConnectCircuit()
    } else {
      setAutoConnectRequest((current) => current + 1)
    }

    setConnectionsLocked(true)
    setConnectionsVerified(true)

    setStatus(SIMULATION_MESSAGES.autoConnect)
    showStepAlert(EXPERIMENT_ALERTS.circuitConnectionsCompleted)
  }

  const handleVoltageControlBlocked = useCallback(() => {
    const alert = connectionsVerified
      ? EXPERIMENT_ALERTS.switchOnMcbBeforeAutotransformer
      : EXPERIMENT_ALERTS.completeConnectionsBeforeAutotransformer
    setStatus(alert.description)
    showStepAlert(alert)
  }, [connectionsVerified, showStepAlert])

  const handleVoltageChange = useCallback((nextVoltage) => {
    setVoltage(nextVoltage)

    if (!powerOn || nextVoltage <= 0) {
      autotransformerReadyAlertShownRef.current = false
      return
    }

    if (
      nextVoltage >= LINE_VOLTAGE
      && voltage < LINE_VOLTAGE
      && !autotransformerReadyAlertShownRef.current
    ) {
      autotransformerReadyAlertShownRef.current = true
      setStatus(SIMULATION_MESSAGES.afterVoltageSet)
      showStepAlert(EXPERIMENT_ALERTS.autotransformerReadingsReady)
    }

  }, [powerOn, showStepAlert, voltage])

  const handleIncreaseLoad = useCallback(() => {
    setActiveLoadLevel(level => Math.min(level + 1, MAX_MOTOR_LOAD_LEVEL))
    const alert = activeLoadLevel === 0
      ? EXPERIMENT_ALERTS.firstHandClick
      : EXPERIMENT_ALERTS.nextHandClick
    setStatus(alert.description)
    showStepAlert(alert)
  }, [activeLoadLevel, showStepAlert])

  return (
    <div id="app-wrapper" ref={wrapperRef}>
      <div
        id="app-viewport"
        style={{
          height: `${scaledHeight}px`,
          width: `${scaledWidth}px`,
        }}
      >
        <div
          id="app-scale"
          style={{
            '--app-scale': scale,
          }}
        >
          <div id="app-render">
            <main className="simulation-shell" id="walkthrough-demo-experiment">
              <HeaderBoard />
              <WalkthroughStartButton variant="side-tab" />
              {/* <StatusBar status={status} /> */}
              <span className="sr-only" role="status" aria-live="polite">{status}</span>

              <section className="workspace-grid">
                <aside className="left-panel">
                  <ActionButtons
                    activeConnectionPair={activeInstruction.connectionPair}
                    activeButtons={{
                      onAiGuide: aiGuidePlaying,
                    }}
                    activeInstructionStepId={activeInstruction.stepId}
                    disabledButtons={{
                      onAdd: !canAddReading,
                      onAutoConnect: connectionsVerified || powerOn,
                      onCheck: connectionsVerified,
                      onPlot: !canPlotGraph,
                      onPrint: false,
                    }}
                    onAdd={recordObservation}
                    onCheck={handleCheck}
                    onPlot={handlePlot}
                    onPrint={handlePrint}
                    onReset={handleReset}
                    onAutoConnect={handleAutoConnect}
                    onAiGuide={handleAiGuide}
                  />

                  <ControlPanel observations={observations} />

                  <FormulaSection />

                  <ReportControls
                    graphGenerated={graphGenerated}
                    minReadings={MIN_GRAPH_READINGS}
                    onGenerateReport={handleGenerateReport}
                    readingCount={readingCount}
                    reportGenerated={reportGenerated}
                  />
                </aside>

                <section className="right-panel">
                  <ConnectionLab
                    key={`connection-lab-${resetRequest}`}
                    activeGuideConnection={aiGuideActiveConnection}
                    autoConnectRequest={autoConnectRequest}
                    checkRequest={checkRequest}
                    connectionsLocked={connectionsLocked}
                    highlightedTerminalIds={aiGuideHighlightedTerminalIds}
                    onAutoConnectReady={handleAutoConnectReady}
                    onCheckConnections={handleCheckConnections}
                    onConnectionRemovalBlocked={handleConnectionRemovalBlocked}
                    onGuideConnectionComplete={handleAiGuideConnectionComplete}
                    onValidateConnectionsReady={handleValidateConnectionsReady}
                    onWiringChange={handleWiringChange}
                    onWrongConnectionMade={handleWrongConnectionMade}
                    powerOn={powerOn}
                    resetRequest={resetRequest}
                    scale={scale}
                    onTogglePower={handleTogglePower}
                    onVoltageControlBlocked={handleVoltageControlBlocked}
                    setVoltage={handleVoltageChange}
                    voltage={voltage}
                    loadLevel={activeLoadLevel}
                    turning={loadTurning}
                    canIncreaseLoad={canIncreaseLoad}
                    readingsReady={readingsReady}
                    reading={reading}
                    onIncreaseLoad={handleIncreaseLoad}
                    onTurningChange={setLoadTurning}
                  />
                </section>
              </section>

            </main>

            <ResultsGraphs
              minReadings={MIN_GRAPH_READINGS}
              observations={observations}
              plotted={graphGenerated}
            />
            <footer className="simulation-footer">
              &copy; 2026 Virtual Labs IIT Roorkee
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
