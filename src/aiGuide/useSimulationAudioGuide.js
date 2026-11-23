import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useWalkthrough } from '../walkthrough/useWalkthrough.js'
import { CURRENT_PROBES_BY_TARGET_ID, REQUIRED_CONNECTIONS, getConnectionInstruction, getConnectionLabel } from '../config/circuitConnections.js'
import { registerExclusiveAudio } from '../audio/exclusiveAudio.js'
import { CONNECTION_AUDIO_BY_LABEL, SIMULATION_AUDIO, SIMULATION_MESSAGES } from '../audio/simulationAudio.js'

const GUIDE_PHASE_IDLE = 'idle'
const GUIDE_PHASE_CLICK = 'click'
const GUIDE_PHASE_WALKTHROUGH = 'walkthrough'
const GUIDE_PHASE_TERMINALS = 'terminals'
const GUIDE_PHASE_EXPERIMENT = 'experiment'
const GUIDE_STEP_GAP_MS = 250
const NEXT_CONNECTION_PROMPT_LIMIT = 1

const canUseSpeechSynthesis = () => (
  typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined'
)

const getConnectionKey = ([firstTerminal, secondTerminal]) => (
  [firstTerminal, secondTerminal].sort().join('|')
)

const wait = (delayMs) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs)
})

const buildConnectionSteps = () => (
  REQUIRED_CONNECTIONS.map((terminalIds) => {
    const label = getConnectionLabel(...terminalIds)
    const text = getConnectionInstruction(...terminalIds)
    const probe = CURRENT_PROBES_BY_TARGET_ID[terminalIds[0]]
      ?? CURRENT_PROBES_BY_TARGET_ID[terminalIds[1]]

    return {
      audio: CONNECTION_AUDIO_BY_LABEL[label] ?? null,
      key: getConnectionKey(terminalIds),
      highlightedTerminalIds: probe ? [probe.targetId] : terminalIds,
      label,
      terminalIds,
      text,
    }
  })
)

export const useSimulationAudioGuide = ({
  onError,
  onFinish,
  onStart,
  onStatus,
  onStop,
} = {}) => {
  const {
    isOpen: walkthroughIsOpen,
  } = useWalkthrough()
  const connectionSteps = useMemo(() => buildConnectionSteps(), [])
  const [activeConnection, setActiveConnection] = useState(null)
  const [highlightedTerminalIds, setHighlightedTerminalIds] = useState([])
  const [phase, setPhase] = useState(GUIDE_PHASE_IDLE)
  const currentPlaybackRef = useRef(null)
  const narrationAudioRef = useRef(null)
  const activeConnectionStepRef = useRef(null)
  const completedConnectionKeysRef = useRef(new Set())
  const pendingConnectionRef = useRef(null)
  const phaseRef = useRef(phase)
  const runIdRef = useRef(0)
  const walkthroughOpenedForGuideRef = useRef(false)
  const feedbackAudioPauseRef = useRef(null)
  const feedbackRequestIdRef = useRef(0)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const stopCurrentPlayback = useCallback(() => {
    const currentPlayback = currentPlaybackRef.current

    if (!currentPlayback) {
      return
    }

    currentPlaybackRef.current = null
    currentPlayback.stop()
  }, [])

  const resolvePendingConnection = useCallback((matched) => {
    const pendingConnection = pendingConnectionRef.current

    if (!pendingConnection) {
      return
    }

    pendingConnectionRef.current = null
    pendingConnection.resolve(matched)
  }, [])

  const beginFeedbackAudio = useCallback(() => {
    const requestId = feedbackRequestIdRef.current + 1

    feedbackRequestIdRef.current = requestId

    if (!feedbackAudioPauseRef.current) {
      let resolvePause
      const promise = new Promise((resolve) => {
        resolvePause = resolve
      })

      feedbackAudioPauseRef.current = {
        promise,
        resolve: resolvePause,
      }
    }

    return requestId
  }, [])

  const finishFeedbackAudio = useCallback((requestId) => {
    if (feedbackRequestIdRef.current !== requestId) {
      return
    }

    const pause = feedbackAudioPauseRef.current

    feedbackAudioPauseRef.current = null
    pause?.resolve()
  }, [])

  const clearFeedbackAudioPause = useCallback(() => {
    feedbackRequestIdRef.current += 1

    const pause = feedbackAudioPauseRef.current

    feedbackAudioPauseRef.current = null
    pause?.resolve()
  }, [])

  const waitForFeedbackAudio = useCallback(async () => {
    while (feedbackAudioPauseRef.current) {
      await feedbackAudioPauseRef.current.promise
    }
  }, [])

  const stop = useCallback(() => {
    runIdRef.current += 1
    phaseRef.current = GUIDE_PHASE_IDLE
    activeConnectionStepRef.current = null
    clearFeedbackAudioPause()
    stopCurrentPlayback()
    resolvePendingConnection(false)
    completedConnectionKeysRef.current = new Set()
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    setPhase(GUIDE_PHASE_IDLE)

    walkthroughOpenedForGuideRef.current = false
    onStop?.()
  }, [
    clearFeedbackAudioPause,
    onStop,
    resolvePendingConnection,
    stopCurrentPlayback,
  ])

  const continueExperiment = useCallback(() => {
    runIdRef.current += 1
    phaseRef.current = GUIDE_PHASE_EXPERIMENT
    activeConnectionStepRef.current = null
    clearFeedbackAudioPause()
    stopCurrentPlayback()
    resolvePendingConnection(false)
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    setPhase(GUIDE_PHASE_EXPERIMENT)
    walkthroughOpenedForGuideRef.current = false
  }, [clearFeedbackAudioPause, resolvePendingConnection, stopCurrentPlayback])

  const playAudio = useCallback((audioSource) => new Promise((resolve, reject) => {
    stopCurrentPlayback()
    const audio = narrationAudioRef.current ?? new Audio()
    narrationAudioRef.current = audio
    audio.src = audioSource
    let exclusivePlayback = null
    let settled = false

    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }

    const settle = (callback) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      exclusivePlayback?.release()
      exclusivePlayback = null

      if (currentPlaybackRef.current?.audio === audio) {
        currentPlaybackRef.current = null
      }

      callback()
    }

    const handleEnded = () => settle(resolve)
    const handleError = () => settle(() => reject(new Error(`Unable to play audio: ${audioSource}`)))

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    currentPlaybackRef.current = {
      audio,
      stop: () => {
        audio.pause()
        audio.currentTime = 0
        settle(resolve)
      },
    }
    exclusivePlayback = registerExclusiveAudio(() => {
      audio.pause()
      audio.currentTime = 0
      settle(resolve)
    })

    audio.play().catch((error) => {
      settle(() => reject(error))
    })
  }), [stopCurrentPlayback])

  const speakText = useCallback((text) => new Promise((resolve, reject) => {
    if (!canUseSpeechSynthesis()) {
      reject(new Error('Speech synthesis is not available in this browser.'))
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    let exclusivePlayback = null
    let settled = false

    const settle = (callback) => {
      if (settled) {
        return
      }

      settled = true
      utterance.onend = null
      utterance.onerror = null

      exclusivePlayback?.release()
      exclusivePlayback = null

      if (currentPlaybackRef.current?.utterance === utterance) {
        currentPlaybackRef.current = null
      }

      callback()
    }

    utterance.lang = 'en-US'
    utterance.pitch = 1
    utterance.rate = 0.95
    utterance.onend = () => settle(resolve)
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        settle(resolve)
        return
      }

      settle(() => reject(new Error(`Speech synthesis failed: ${event.error}`)))
    }

    currentPlaybackRef.current = {
      stop: () => {
        window.speechSynthesis.cancel()
        settle(resolve)
      },
      utterance,
    }
    exclusivePlayback = registerExclusiveAudio(() => {
      window.speechSynthesis.cancel()
      settle(resolve)
    })

    window.speechSynthesis.speak(utterance)
  }), [])

  const playNarration = useCallback(async ({ audio, text }) => {
    if (audio) {
      try {
        await playAudio(audio)
        return
      } catch (error) {
        if (!text) {
          throw error
        }
      }
    }

    await speakText(text)
  }, [playAudio, speakText])

  const playFeedback = useCallback(async (narration) => {
    const runId = runIdRef.current
    const connectionStep = activeConnectionStepRef.current
    const requestId = beginFeedbackAudio()

    try {
      onStatus?.(narration.text)
      await playNarration(narration)

      if (
        feedbackRequestIdRef.current !== requestId
        || runIdRef.current !== runId
        || phaseRef.current !== GUIDE_PHASE_TERMINALS
        || !connectionStep
        || activeConnectionStepRef.current?.key !== connectionStep.key
        || completedConnectionKeysRef.current.has(connectionStep.key)
      ) {
        return true
      }

      onStatus?.(`${connectionStep.text} Make the highlighted connection to continue.`)
      setHighlightedTerminalIds(connectionStep.highlightedTerminalIds)
      await playNarration(connectionStep)
    } catch (error) {
      if (
        feedbackRequestIdRef.current === requestId
        && runIdRef.current === runId
      ) {
        onError?.(error)
      }
    } finally {
      finishFeedbackAudio(requestId)
    }

    return true
  }, [
    beginFeedbackAudio,
    finishFeedbackAudio,
    onError,
    onStatus,
    playNarration,
  ])

  const playWrongConnectionSequence = useCallback(() => {
    if (phaseRef.current !== GUIDE_PHASE_TERMINALS) {
      return Promise.resolve(false)
    }

    return playFeedback({
      audio: SIMULATION_AUDIO.wrongConnection,
      text: SIMULATION_MESSAGES.wrongConnection,
    })
  }, [playFeedback])

  const waitForConnection = useCallback((connectionStep, runId) => {
    if (completedConnectionKeysRef.current.has(connectionStep.key)) {
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      pendingConnectionRef.current = {
        key: connectionStep.key,
        resolve,
        runId,
      }
    })
  }, [])

  const runTerminalGuide = useCallback(async (runId) => {
    phaseRef.current = GUIDE_PHASE_TERMINALS
    setPhase(GUIDE_PHASE_TERMINALS)
    activeConnectionStepRef.current = null
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    onStatus?.(SIMULATION_MESSAGES.walkthroughComplete)

    try {
      await waitForFeedbackAudio()

      if (runIdRef.current !== runId) {
        return
      }

      await playNarration({
        audio: SIMULATION_AUDIO.walkthroughComplete,
        text: SIMULATION_MESSAGES.walkthroughComplete,
      })

      await waitForFeedbackAudio()

      if (runIdRef.current !== runId) {
        return
      }

      for (let index = 0; index < connectionSteps.length; index += 1) {
        const connectionStep = connectionSteps[index]

        if (completedConnectionKeysRef.current.has(connectionStep.key)) {
          continue
        }

        await waitForFeedbackAudio()

        if (runIdRef.current !== runId) {
          return
        }

        activeConnectionStepRef.current = connectionStep
        setActiveConnection(connectionStep.terminalIds)
        setHighlightedTerminalIds(connectionStep.highlightedTerminalIds)
        onStatus?.(`${connectionStep.text} Make the highlighted connection to continue.`)

        await playNarration(connectionStep)

        if (runIdRef.current !== runId) {
          return
        }

        const matched = await waitForConnection(connectionStep, runId)

        if (!matched || runIdRef.current !== runId) {
          return
        }

        await waitForFeedbackAudio()

        if (runIdRef.current !== runId) {
          return
        }

        activeConnectionStepRef.current = null
        setHighlightedTerminalIds([])

        if (index < NEXT_CONNECTION_PROMPT_LIMIT && index < connectionSteps.length - 1) {
          await playNarration({
            audio: SIMULATION_AUDIO.nextConnection,
            text: SIMULATION_MESSAGES.nextConnection,
          })

          await waitForFeedbackAudio()
          await wait(GUIDE_STEP_GAP_MS)
          await waitForFeedbackAudio()
        }

        if (runIdRef.current !== runId) {
          return
        }
      }

      await waitForFeedbackAudio()

      if (runIdRef.current !== runId) {
        return
      }

      setActiveConnection(null)
      activeConnectionStepRef.current = null
      setHighlightedTerminalIds([])
      onStatus?.(SIMULATION_MESSAGES.allGuideConnectionsComplete)

      await playNarration({
        audio: SIMULATION_AUDIO.allGuideConnectionsComplete,
        text: SIMULATION_MESSAGES.allGuideConnectionsComplete,
      })

      await waitForFeedbackAudio()

      if (runIdRef.current !== runId) {
        return
      }

      if (runIdRef.current === runId) {
        phaseRef.current = GUIDE_PHASE_EXPERIMENT
        setPhase(GUIDE_PHASE_EXPERIMENT)
        onFinish?.()
      }
    } catch (error) {
      if (runIdRef.current !== runId) {
        return
      }

      phaseRef.current = GUIDE_PHASE_IDLE
      activeConnectionStepRef.current = null
      setActiveConnection(null)
      setHighlightedTerminalIds([])
      setPhase(GUIDE_PHASE_IDLE)
      onError?.(error)
    }
  }, [
    connectionSteps,
    onError,
    onFinish,
    onStatus,
    playNarration,
    waitForConnection,
    waitForFeedbackAudio,
  ])

  const start = useCallback(async ({ completedConnections = [], narration = null } = {}) => {
    if (phaseRef.current !== GUIDE_PHASE_IDLE) {
      stop()
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    completedConnectionKeysRef.current = new Set(completedConnections.map(getConnectionKey))
    const nextPhase = narration ? GUIDE_PHASE_EXPERIMENT : GUIDE_PHASE_CLICK
    phaseRef.current = nextPhase
    walkthroughOpenedForGuideRef.current = false
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    setPhase(nextPhase)
    onStart?.()
    onStatus?.('AI Guide narration started.')

    try {
      if (narration) {
        onStatus?.(narration.text)
        await playNarration(narration)
        return
      }

      await playNarration({
        audio: SIMULATION_AUDIO.aiGuideClick,
        text: SIMULATION_MESSAGES.aiGuideClick,
      })

      await waitForFeedbackAudio()

      if (runIdRef.current !== runId) {
        return
      }

      phaseRef.current = GUIDE_PHASE_WALKTHROUGH
      setPhase(GUIDE_PHASE_WALKTHROUGH)
      onStatus?.('Click Start Walkthrough and finish it to continue the AI guide.')
    } catch (error) {
      if (runIdRef.current !== runId) {
        return
      }

      phaseRef.current = GUIDE_PHASE_IDLE
      setPhase(GUIDE_PHASE_IDLE)
      onError?.(error)
    }
  }, [onError, onStart, onStatus, playNarration, stop, waitForFeedbackAudio])

  const handleConnectionComplete = useCallback((terminalIds) => {
    if (!terminalIds?.length) {
      return
    }

    const connectionKey = getConnectionKey(terminalIds)

    completedConnectionKeysRef.current.add(connectionKey)

    if (
      phaseRef.current === GUIDE_PHASE_TERMINALS
      && activeConnectionStepRef.current?.key === connectionKey
      && !feedbackAudioPauseRef.current
    ) {
      stopCurrentPlayback()
    }

    const pendingConnection = pendingConnectionRef.current

    if (
      pendingConnection
      && pendingConnection.key === connectionKey
      && pendingConnection.runId === runIdRef.current
    ) {
      pendingConnectionRef.current = null
      pendingConnection.resolve(true)
    }
  }, [stopCurrentPlayback])

  useEffect(() => {
    if (phase !== GUIDE_PHASE_WALKTHROUGH) {
      return
    }

    if (walkthroughIsOpen) {
      walkthroughOpenedForGuideRef.current = true
      return
    }

    if (!walkthroughOpenedForGuideRef.current) {
      return
    }

    walkthroughOpenedForGuideRef.current = false
    runTerminalGuide(runIdRef.current)
  }, [phase, runTerminalGuide, walkthroughIsOpen])

  useEffect(() => () => {
    runIdRef.current += 1
    activeConnectionStepRef.current = null
    clearFeedbackAudioPause()
    stopCurrentPlayback()
    resolvePendingConnection(false)
  }, [
    clearFeedbackAudioPause,
    resolvePendingConnection,
    stopCurrentPlayback,
  ])

  return {
    activeConnection,
    continueExperiment,
    highlightedTerminalIds,
    isPlaying: phase !== GUIDE_PHASE_IDLE,
    phase,
    playFeedback,
    playWrongConnectionSequence,
    start,
    stop,
    onConnectionComplete: handleConnectionComplete,
  }
}
