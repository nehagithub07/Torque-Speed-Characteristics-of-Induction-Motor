import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { EXPERIMENT_ALERTS } from './alerts/experimentStepAlerts.js'
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { useSimulationAudioGuide } from './aiGuide/useSimulationAudioGuide.js'
import { CONNECTION_AUDIO_BY_LABEL, SIMULATION_AUDIO } from './audio/simulationAudio.js'
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
const FOOTER_HEIGHT = 32
const CONTENT_HEIGHT = BASE_HEIGHT
  + GRAPH_SECTION_GAP
  + RESULTS_GRAPH_SECTION_HEIGHT
  + FOOTER_HEIGHT
const PANEL_MAX_SCALE = 1
const PANEL_VIEWPORT_MARGIN = 32
const MIN_RENDER_SCALE = 2
const MAX_RENDER_SCALE = 3
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
  normalizedVoltage,
  powerOn,
  wiringProgress,
  readingCount,
  hasDuplicateReading,
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

  return {
    connectionPair: null,
    stepId: readingCount >= MAX_OBSERVATIONS ? 'finish' : hasDuplicateReading ? 'load' : 'add',
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
    return SIMULATION_AUDIO.multipleWrongConnections
  }

  if (result.wrongConnections?.length > 0 || result.missingConnections?.length > 0) {
    return getConnectionResultAudio(result)
  }

  return SIMULATION_AUDIO.multipleWrongConnections
}

const getScale = () => {
  if (typeof window === 'undefined') {
    return 1
  }

  const widthScale = (window.innerWidth - PANEL_VIEWPORT_MARGIN) / BASE_WIDTH

  return Math.max(Math.min(widthScale, PANEL_MAX_SCALE), 0.1)
}

const getRenderScale = () => {
  if (typeof window === 'undefined') {
    return MIN_RENDER_SCALE
  }

  const dpr = Number.isFinite(window.devicePixelRatio)
    ? window.devicePixelRatio
    : 1

  return Math.min(Math.max(Math.ceil(dpr), MIN_RENDER_SCALE), MAX_RENDER_SCALE)
}

const getViewportMetrics = () => ({
  renderScale: getRenderScale(),
  scale: getScale(),
})

const App = () => {
  const { clearAlerts, showStepAlert } = useLabAlerts()
  const {
    play: playSimulationAudio,
    playSequence: playSimulationAudioSequence,
    stop: stopSimulationAudio,
  } = useQueuedAudioPlayer()
  const [viewportMetrics, setViewportMetrics] = useState(getViewportMetrics)
  const { renderScale, scale } = viewportMetrics
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
  const correctCheckPromptPendingRef = useRef(false)
  const firstEmptyCheckPromptPlayedRef = useRef(false)
  const validateConnectionsRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setViewportMetrics(getViewportMetrics())

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const reading = getMotorLoadReading(activeLoadLevel)

  const normalizedVoltage = Number(voltage.toFixed(1))
  const hasDuplicateReading = observations.some((row) => (
    row.loadLevel === activeLoadLevel
  ))
  const readingCount = observations.length
  const canPlotGraph = readingCount >= MIN_GRAPH_READINGS
  const readingsReady = connectionsVerified && powerOn && normalizedVoltage >= LINE_VOLTAGE
  const canAddReading = readingsReady && !loadTurning && !hasDuplicateReading && readingCount < MAX_OBSERVATIONS
  const canIncreaseLoad = readingsReady && hasDuplicateReading && !loadTurning && activeLoadLevel < MAX_MOTOR_LOAD_LEVEL
  const loadHint = !readingsReady ? 'Verify wiring, turn on the MCB, then set 400 V.'
    : loadTurning ? 'Turning the handle…'
      : !hasDuplicateReading ? 'Click ADD to record this load.'
        : activeLoadLevel < MAX_MOTOR_LOAD_LEVEL ? 'Click the hand to increase the load.'
          : 'All six readings recorded. Click PLOT.'

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

    if (!normalizedProgress.isCorrect) {
      correctCheckPromptPendingRef.current = false
    }

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
    correctCheckPromptPendingRef.current = false
    setStatus('AI Guide narration started.')
  }, [])

  const handleAiGuideFinish = useCallback(() => {
    correctCheckPromptPendingRef.current = true
    setStatus('AI Guide connection guidance completed.')
  }, [])

  const handleAiGuideError = useCallback(() => {
    correctCheckPromptPendingRef.current = false
    setStatus('AI Guide narration could not start. Add audio files or use a browser with speech synthesis.')
  }, [])

  const handleAiGuideStop = useCallback(() => {
    correctCheckPromptPendingRef.current = false
    setStatus('AI Guide narration stopped.')
  }, [])

  const {
    activeConnection: aiGuideActiveConnection,
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
    startAiGuide()
  }, [aiGuidePlaying, startAiGuide, stopAiGuide, stopSimulationAudio])

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

    if (readingCount >= MAX_OBSERVATIONS) {
      setStatus('All load readings are already recorded. Plot the graph or reset for a new run.')
      showStepAlert(EXPERIMENT_ALERTS.minimumReadingsRequired, {
        description: `The observation table already contains the maximum ${MAX_OBSERVATIONS} readings.`,
        title: 'Observation Table Is Full',
      })
      return
    }

    if (hasDuplicateReading) {
      setStatus('This load is already recorded. Click the hand to increase the brake load.')
      showStepAlert(EXPERIMENT_ALERTS.readingAlreadyExists)
      return
    }

    const nextObservationId = (observations.at(-1)?.id ?? 0) + 1
    const nextObservation = createMotorObservation({ id: nextObservationId, loadLevel: activeLoadLevel })
    const nextObservationCount = readingCount + 1
    const readingAddedAlert = {
      ...EXPERIMENT_ALERTS.readingAdded,
      description: nextObservationCount === MAX_OBSERVATIONS
        ? 'All six readings recorded. Click PLOT to view the motor load-test graphs.'
        : `Reading ${nextObservationCount} recorded. Click the hand to turn the pulley handle and increase the load.`,
      target: nextObservationCount === MAX_OBSERVATIONS ? '#plot-button' : '#pulley-hand-control',
    }

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
    correctCheckPromptPendingRef.current = false
    firstEmptyCheckPromptPlayedRef.current = false
    setStatus('The simulation has been reset. You can start again.')
    showStepAlert(EXPERIMENT_ALERTS.simulationReset)
  }, [showStepAlert, stopAiGuide, stopSimulationAudio])

  const handleReset = () => {
    clearAlerts()
    resetSimulation()
    playSimulationAudio(SIMULATION_AUDIO.reset)
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
        description: 'Click the Plot button to generate the graphs before generating a report.',
        target: '#plot-button',
        title: 'Plot Graph Before Report',
      })
      return
    }

    playSimulationAudio(SIMULATION_AUDIO.generateReportClick)
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
    const shouldPlayFirstEmptyCheckPrompt = (
      result.totalConnections === 0
      && !firstEmptyCheckPromptPlayedRef.current
    )
    const shouldPlayCorrectCheckPrompt = result.isCorrect && correctCheckPromptPendingRef.current
    const checkResultAudio = shouldPlayFirstEmptyCheckPrompt
      ? SIMULATION_AUDIO.firstCheckClick
      : shouldPlayCorrectCheckPrompt
      ? SIMULATION_AUDIO.forCorrectConnectionsCheckClick
      : getCheckResultAudio(result)

    if (result.totalConnections === 0) {
      firstEmptyCheckPromptPlayedRef.current = true
    }

    if (result.isCorrect) {
      correctCheckPromptPendingRef.current = false
    }

    playSimulationAudio(checkResultAudio)

    if (result.isCorrect) {
      setConnectionsLocked(true)
      setConnectionsVerified(true)

      setStatus('Connections Verified successfully. Now turn ON the MCB by clicking the MCB lever.')
      showStepAlert(EXPERIMENT_ALERTS.connectionsVerified, {
        description: 'Connections Verified successfully. Now turn ON the MCB by clicking the MCB lever.',
        target: '#power-toggle-button',
        title: 'Connections Verified',
      })

      return
    }

    setConnectionsVerified(false)

    if (result.totalConnections === 0) {
      setStatus('Please make the connections first.')
      showStepAlert(EXPERIMENT_ALERTS.connectionErrorFound, {
        description: 'Please make the required connections as per the given instructions.',
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
      description: `Matched ${result.matchedCount} of ${REQUIRED_CONNECTION_COUNT} required wire pairs from ${result.totalConnections} total wires.`,
    })
  }, [playSimulationAudio, showStepAlert])

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
      playSimulationAudio(SIMULATION_AUDIO.beforeConnectionMcbAlert)
      setStatus('Make and check the connections before turning ON the MCB.')
      showStepAlert(EXPERIMENT_ALERTS.makeConnectionsBeforeMcb)
      return
    }

    if (powerOn) {
      return
    }

    setPowerOn(true)
    playSimulationAudio(SIMULATION_AUDIO.mcbOn)
    setStatus('MCB has been turned ON. Next, click on the autotransformer knob to set the desired voltage.')
    showStepAlert(EXPERIMENT_ALERTS.powerOn, {
      description: 'MCB has been turned ON. Next, click on the autotransformer knob to set the desired voltage.',
      target: '#voltage-control',
      title: 'MCB Turned ON',
    })
  }
  const handleAutoConnect = () => {
    const wasAiGuidePlaying = aiGuidePlaying

    if (wasAiGuidePlaying) {
      stopAiGuide()
    }

    const autoConnectCircuit = autoConnectCircuitRef.current

    if (autoConnectCircuit) {
      autoConnectCircuit()
    } else {
      setAutoConnectRequest((current) => current + 1)
    }

    setConnectionsLocked(true)
    setConnectionsVerified(true)

    playSimulationAudio(SIMULATION_AUDIO.autoConnect)

    setStatus('Autoconnect Completed. Connections are verified, click on the MCB to turn it ON.')
    showStepAlert(EXPERIMENT_ALERTS.circuitConnectionsCompleted, {
      description: 'Autoconnect completed. Now turn ON the MCB by clicking the MCB lever.',
      target: '#power-toggle-button',
      title: 'Autoconnect Completed',
    })
  }

  const handleVoltageControlBlocked = useCallback(() => {
    playSimulationAudio(SIMULATION_AUDIO.autotransformerBlocked)
    setStatus('Please complete the connections first and turn ON the MCB.')
    showStepAlert(EXPERIMENT_ALERTS.completeConnectionsBeforeAutotransformer)
  }, [playSimulationAudio, showStepAlert])

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
      setStatus('The line voltage is set to 400 V. Click ADD to record the no-load readings.')
      showStepAlert(EXPERIMENT_ALERTS.autotransformerReadingsReady, {
        description: 'The line voltage is set to 400 V. The analyser shows the supplied phase readings. Click ADD to record the no-load readings.',
        target: '#add-reading-button',
        title: 'No-load Readings Ready',
      })
    }

  }, [powerOn, showStepAlert, voltage])

  const handleIncreaseLoad = useCallback(() => {
    setActiveLoadLevel(level => Math.min(level + 1, MAX_MOTOR_LOAD_LEVEL))
    setStatus('Brake load increased. Click ADD when the hand finishes turning.')
  }, [])

  return (
    <div id="app-wrapper">
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
            '--app-render-scale': renderScale,
            height: `${CONTENT_HEIGHT * renderScale}px`,
            width: `${BASE_WIDTH * renderScale}px`,
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
                    loadHint={loadHint}
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
