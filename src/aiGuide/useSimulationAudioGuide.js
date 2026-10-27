import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useWalkthrough } from '../walkthrough/useWalkthrough.js'
import { REQUIRED_CONNECTIONS, getConnectionInstruction, getConnectionLabel } from '../config/circuitConnections.js'
import { registerExclusiveAudio } from '../audio/exclusiveAudio.js'
import { CONNECTION_AUDIO_BY_LABEL, SIMULATION_AUDIO } from '../audio/simulationAudio.js'

const GUIDE_PHASE_IDLE = 'idle'
const GUIDE_PHASE_CLICK = 'click'
const GUIDE_PHASE_WALKTHROUGH = 'walkthrough'
const GUIDE_PHASE_TERMINALS = 'terminals'
const GUIDE_STEP_GAP_MS = 250
const NEXT_CONNECTION_PROMPT_LIMIT = 3

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

    return {
      audio: CONNECTION_AUDIO_BY_LABEL[label] ?? null,
      key: getConnectionKey(terminalIds),
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
  const activeConnectionStepRef = useRef(null)
  const completedConnectionKeysRef = useRef(new Set())
  const pendingConnectionRef = useRef(null)
  const phaseRef = useRef(phase)
  const runIdRef = useRef(0)
  const walkthroughOpenedForGuideRef = useRef(false)
  const wrongConnectionAudioPauseRef = useRef(null)
  const wrongConnectionRequestIdRef = useRef(0)

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

  const beginWrongConnectionAudio = useCallback(() => {
    const requestId = wrongConnectionRequestIdRef.current + 1

    wrongConnectionRequestIdRef.current = requestId

    if (!wrongConnectionAudioPauseRef.current) {
      let resolvePause
      const promise = new Promise((resolve) => {
        resolvePause = resolve
      })

      wrongConnectionAudioPauseRef.current = {
        promise,
        resolve: resolvePause,
      }
    }

    return {
      hasActiveConnection: (
        phaseRef.current === GUIDE_PHASE_TERMINALS
        && Boolean(activeConnectionStepRef.current)
      ),
      requestId,
      terminalGuideActive: phaseRef.current === GUIDE_PHASE_TERMINALS,
    }
  }, [])

  const finishWrongConnectionAudio = useCallback((requestId) => {
    if (wrongConnectionRequestIdRef.current !== requestId) {
      return
    }

    const pause = wrongConnectionAudioPauseRef.current

    wrongConnectionAudioPauseRef.current = null
    pause?.resolve()
  }, [])

  const clearWrongConnectionAudioPause = useCallback(() => {
    wrongConnectionRequestIdRef.current += 1

    const pause = wrongConnectionAudioPauseRef.current

    wrongConnectionAudioPauseRef.current = null
    pause?.resolve()
  }, [])

  const waitForWrongConnectionAudio = useCallback(async () => {
    while (wrongConnectionAudioPauseRef.current) {
      await wrongConnectionAudioPauseRef.current.promise
    }
  }, [])

  const stop = useCallback(() => {
    runIdRef.current += 1
    phaseRef.current = GUIDE_PHASE_IDLE
    activeConnectionStepRef.current = null
    clearWrongConnectionAudioPause()
    stopCurrentPlayback()
    resolvePendingConnection(false)
    completedConnectionKeysRef.current = new Set()
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    setPhase(GUIDE_PHASE_IDLE)

    walkthroughOpenedForGuideRef.current = false
    onStop?.()
  }, [
    clearWrongConnectionAudioPause,
    onStop,
    resolvePendingConnection,
    stopCurrentPlayback,
  ])

  const playAudio = useCallback((audioSource) => new Promise((resolve, reject) => {
    const audio = new Audio(audioSource)
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
  }), [])

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

  const playWrongConnectionSequence = useCallback(async () => {
    const runId = runIdRef.current
    const connectionStep = activeConnectionStepRef.current

    if (phaseRef.current !== GUIDE_PHASE_TERMINALS) {
      return false
    }

    const { requestId } = beginWrongConnectionAudio()

    try {
      await playNarration({
        audio: SIMULATION_AUDIO.wrongConnection,
        text: 'Wrong connection.',
      })

      if (
        wrongConnectionRequestIdRef.current !== requestId
        || runIdRef.current !== runId
        || phaseRef.current !== GUIDE_PHASE_TERMINALS
        || !connectionStep
        || activeConnectionStepRef.current?.key !== connectionStep.key
      ) {
        return true
      }

      onStatus?.(`${connectionStep.text} Make the highlighted connection to continue.`)
      await playNarration(connectionStep)
    } catch (error) {
      if (
        wrongConnectionRequestIdRef.current === requestId
        && runIdRef.current === runId
      ) {
        onError?.(error)
      }
    } finally {
      finishWrongConnectionAudio(requestId)
    }

    return true
  }, [
    beginWrongConnectionAudio,
    finishWrongConnectionAudio,
    onError,
    onStatus,
    playNarration,
  ])

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
    onStatus?.('The interface walkthrough is now complete.')

    try {
      await waitForWrongConnectionAudio()

      if (runIdRef.current !== runId) {
        return
      }

      await playNarration({
        audio: SIMULATION_AUDIO.walkthroughComplete,
        text: 'The interface walkthrough is now complete.',
      })

      await waitForWrongConnectionAudio()

      if (runIdRef.current !== runId) {
        return
      }

      for (let index = 0; index < connectionSteps.length; index += 1) {
        const connectionStep = connectionSteps[index]

        await waitForWrongConnectionAudio()

        if (runIdRef.current !== runId) {
          return
        }

        activeConnectionStepRef.current = connectionStep
        setActiveConnection(connectionStep.terminalIds)
        setHighlightedTerminalIds(connectionStep.terminalIds)
        onStatus?.(`${connectionStep.text} Make the highlighted connection to continue.`)

        await playNarration(connectionStep)

        if (runIdRef.current !== runId) {
          return
        }

        const matched = await waitForConnection(connectionStep, runId)

        if (!matched || runIdRef.current !== runId) {
          return
        }

        await waitForWrongConnectionAudio()

        if (runIdRef.current !== runId) {
          return
        }

        activeConnectionStepRef.current = null

        if (index < NEXT_CONNECTION_PROMPT_LIMIT && index < connectionSteps.length - 1) {
          await playNarration({
            audio: SIMULATION_AUDIO.nextConnection,
            text: "Let's move on to the next connection.",
          })

          await waitForWrongConnectionAudio()
          await wait(GUIDE_STEP_GAP_MS)
          await waitForWrongConnectionAudio()
        }

        if (runIdRef.current !== runId) {
          return
        }
      }

      await waitForWrongConnectionAudio()

      if (runIdRef.current !== runId) {
        return
      }

      setActiveConnection(null)
      activeConnectionStepRef.current = null
      setHighlightedTerminalIds([])
      onStatus?.('All guided terminal connections are complete.')

      await playNarration({
        audio: SIMULATION_AUDIO.allGuideConnectionsComplete,
        text: 'All guided terminal connections are complete.',
      })

      await waitForWrongConnectionAudio()

      if (runIdRef.current !== runId) {
        return
      }

      if (runIdRef.current === runId) {
        phaseRef.current = GUIDE_PHASE_IDLE
        setPhase(GUIDE_PHASE_IDLE)
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
    waitForWrongConnectionAudio,
  ])

  const start = useCallback(async () => {
    if (phaseRef.current !== GUIDE_PHASE_IDLE) {
      stop()
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    completedConnectionKeysRef.current = new Set()
    phaseRef.current = GUIDE_PHASE_CLICK
    walkthroughOpenedForGuideRef.current = false
    setActiveConnection(null)
    setHighlightedTerminalIds([])
    setPhase(GUIDE_PHASE_CLICK)
    onStart?.()
    onStatus?.('AI Guide narration started.')

    try {
      await playNarration({
        audio: SIMULATION_AUDIO.aiGuideClick,
        text: 'AI Guide click.',
      })

      await waitForWrongConnectionAudio()

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
  }, [onError, onStart, onStatus, playNarration, stop, waitForWrongConnectionAudio])

  const handleConnectionComplete = useCallback((terminalIds) => {
    if (!terminalIds?.length) {
      return
    }

    const connectionKey = getConnectionKey(terminalIds)

    completedConnectionKeysRef.current.add(connectionKey)

    const pendingConnection = pendingConnectionRef.current

    if (
      pendingConnection
      && pendingConnection.key === connectionKey
      && pendingConnection.runId === runIdRef.current
    ) {
      pendingConnectionRef.current = null
      pendingConnection.resolve(true)
    }
  }, [])

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
    clearWrongConnectionAudioPause()
    stopCurrentPlayback()
    resolvePendingConnection(false)
  }, [
    clearWrongConnectionAudioPause,
    resolvePendingConnection,
    stopCurrentPlayback,
  ])

  return {
    activeConnection,
    highlightedTerminalIds,
    isPlaying: phase !== GUIDE_PHASE_IDLE,
    phase,
    playWrongConnectionSequence,
    start,
    stop,
    onConnectionComplete: handleConnectionComplete,
  }
}
