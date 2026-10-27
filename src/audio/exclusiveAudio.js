let activePlayback = null
let nextPlaybackId = 0

const stopSpeechSynthesis = () => {
  if (
    typeof window !== 'undefined'
    && typeof window.speechSynthesis !== 'undefined'
  ) {
    window.speechSynthesis.cancel()
  }
}

export const stopExclusiveAudio = () => {
  const playback = activePlayback

  activePlayback = null
  nextPlaybackId += 1

  playback?.stop?.()
  stopSpeechSynthesis()
}

export const registerExclusiveAudio = (stop) => {
  stopExclusiveAudio()

  const id = nextPlaybackId + 1

  nextPlaybackId = id
  activePlayback = {
    id,
    stop,
  }

  return {
    isActive: () => activePlayback?.id === id,
    release: () => {
      if (activePlayback?.id === id) {
        activePlayback = null
      }
    },
  }
}
