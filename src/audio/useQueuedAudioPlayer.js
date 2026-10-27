import { useCallback, useEffect, useRef } from 'react'

import { registerExclusiveAudio, stopExclusiveAudio } from './exclusiveAudio.js'

export const useQueuedAudioPlayer = () => {
  const activeAudioRef = useRef(null)
  const runIdRef = useRef(0)

  const stop = useCallback(() => {
    runIdRef.current += 1
    activeAudioRef.current = null
    stopExclusiveAudio()
  }, [])

  const playNow = useCallback((audioSource, runId) => new Promise((resolve) => {
    if (!audioSource || typeof Audio === 'undefined') {
      resolve(false)
      return
    }

    const audio = new Audio(audioSource)
    let exclusivePlayback = null
    let settled = false

    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('pause', handlePause)
    }

    const settle = (played) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      exclusivePlayback?.release()
      exclusivePlayback = null

      if (activeAudioRef.current === audio) {
        activeAudioRef.current = null
      }

      resolve(played)
    }

    const handleEnded = () => settle(true)
    const handleError = () => settle(false)
    const handlePause = () => settle(false)

    if (runIdRef.current !== runId) {
      resolve(false)
      return
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('pause', handlePause)
    exclusivePlayback = registerExclusiveAudio(() => {
      audio.pause()
      audio.currentTime = 0
      settle(false)
    })
    activeAudioRef.current = audio

    audio.play().catch(() => settle(false))
  }), [])

  const play = useCallback((audioSource) => {
    stop()

    const runId = runIdRef.current

    return playNow(audioSource, runId)
  }, [playNow, stop])

  const playSequence = useCallback(async (audioSources) => {
    stop()

    const runId = runIdRef.current

    for (const audioSource of audioSources.filter(Boolean)) {
      if (runIdRef.current !== runId) {
        return false
      }

      const played = await playNow(audioSource, runId)

      if (!played || runIdRef.current !== runId) {
        return false
      }
    }

    return true
  }, [playNow, stop])

  useEffect(() => stop, [stop])

  return {
    play,
    playSequence,
    stop,
  }
}
