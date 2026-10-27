import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { registerExclusiveAudio } from '../../audio/exclusiveAudio.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

const EDGE_GAP = 16
const TARGET_GAP = 18
const DEFAULT_POPUP_SIZE = {
  height: 280,
  width: 360,
}

const isValidAudioSource = (audio) => Boolean(audio && audio !== '#')

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const renderFormattedDescription = (description) => (
  String(description).split(/(\*\*.*?\*\*)/g).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part
  ))
)

const getPlacementOrder = (placement) => {
  const fallbackPlacements = ['bottom', 'right', 'left', 'top']

  return [
    placement,
    ...fallbackPlacements.filter((item) => item !== placement),
  ].filter(Boolean)
}

const getCandidatePosition = (rect, size, placement) => {
  const target = rect ?? {
    height: 0,
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    width: 0,
  }

  if (placement === 'top') {
    return {
      left: target.left + target.width / 2 - size.width / 2,
      top: target.top - size.height - TARGET_GAP,
    }
  }

  if (placement === 'left') {
    return {
      left: target.left - size.width - TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  if (placement === 'right') {
    return {
      left: target.left + target.width + TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  return {
    left: target.left + target.width / 2 - size.width / 2,
    top: target.top + target.height + TARGET_GAP,
  }
}

const getPopupPosition = (rect, size, preferredPlacement) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - size.width - EDGE_GAP)
  const maxTop = Math.max(EDGE_GAP, viewportHeight - size.height - EDGE_GAP)
  const placements = getPlacementOrder(preferredPlacement)

  for (const placement of placements) {
    const candidate = getCandidatePosition(rect, size, placement)
    const fitsHorizontally = candidate.left >= EDGE_GAP && candidate.left + size.width <= viewportWidth - EDGE_GAP
    const fitsVertically = candidate.top >= EDGE_GAP && candidate.top + size.height <= viewportHeight - EDGE_GAP

    if (fitsHorizontally && fitsVertically) {
      return {
        placement,
        left: candidate.left,
        top: candidate.top,
      }
    }
  }

  const fallback = getCandidatePosition(rect, size, preferredPlacement)

  return {
    placement: preferredPlacement,
    left: clamp(fallback.left, EDGE_GAP, maxLeft),
    top: clamp(fallback.top, EDGE_GAP, maxTop),
  }
}

const WalkthroughPopup = ({
  activeStep,
  autoPlayAudio,
  canGoNext,
  canGoPrevious,
  currentStep,
  onExit,
  onNext,
  onPrevious,
  onSkip,
  targetRect,
  totalSteps,
}) => {
  const popupRef = useRef(null)
  const audioRef = useRef(null)
  const exclusivePlaybackRef = useRef(null)
  const [popupSize, setPopupSize] = useState(DEFAULT_POPUP_SIZE)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioSource = isValidAudioSource(activeStep.audio) ? activeStep.audio : null
  const titleId = `walkthrough-title-${activeStep.id}`
  const descriptionId = `walkthrough-description-${activeStep.id}`
  const progressPercent = (currentStep / totalSteps) * 100
  const secondaryActionLabel = canGoNext ? 'Skip' : 'Finish'
  const secondaryActionClassName = canGoNext
    ? 'walkthrough-popup__button walkthrough-popup__button--secondary'
    : 'walkthrough-popup__button walkthrough-popup__button--primary walkthrough-popup__button--finish'
  const handleSecondaryAction = canGoNext ? onSkip : onExit

  useFocusTrap(popupRef, true)

  const releaseExclusivePlayback = useCallback(() => {
    exclusivePlaybackRef.current?.release()
    exclusivePlaybackRef.current = null
  }, [])

  const stopPopupAudio = useCallback((audio, reset = true) => {
    audio.pause()

    if (reset) {
      audio.currentTime = 0
    }

    releaseExclusivePlayback()
    setIsPlaying(false)
  }, [releaseExclusivePlayback])

  const startPopupAudio = useCallback((audio) => {
    releaseExclusivePlayback()
    exclusivePlaybackRef.current = registerExclusiveAudio(() => {
      stopPopupAudio(audio)
    })

    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        releaseExclusivePlayback()
        setIsPlaying(false)
      })
  }, [releaseExclusivePlayback, stopPopupAudio])

  useLayoutEffect(() => {
    if (!popupRef.current) {
      return
    }

    const popupBox = popupRef.current.getBoundingClientRect()

    setPopupSize({
      height: popupBox.height,
      width: popupBox.width,
    })
  }, [activeStep.id, targetRect])

  useEffect(() => {
    const resetPlayingTimer = window.setTimeout(() => setIsPlaying(false), 0)

    if (!audioSource) {
      audioRef.current = null
      return () => window.clearTimeout(resetPlayingTimer)
    }

    const audio = new Audio(audioSource)
    audioRef.current = audio

    const handleEnded = () => {
      releaseExclusivePlayback()
      setIsPlaying(false)
    }
    const handleError = () => {
      releaseExclusivePlayback()
      setIsPlaying(false)
    }
    const handlePause = () => {
      releaseExclusivePlayback()
      setIsPlaying(false)
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('pause', handlePause)

    if (autoPlayAudio) {
      startPopupAudio(audio)
    }

    return () => {
      window.clearTimeout(resetPlayingTimer)
      stopPopupAudio(audio)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('pause', handlePause)
    }
  }, [activeStep.id, audioSource, autoPlayAudio, releaseExclusivePlayback, startPopupAudio, stopPopupAudio])

  const popupPosition = useMemo(
    () => getPopupPosition(targetRect, popupSize, activeStep.placement),
    [activeStep.placement, popupSize, targetRect],
  )

  const toggleAudio = () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (isPlaying) {
      audio.pause()
      releaseExclusivePlayback()
      setIsPlaying(false)
      return
    }

    startPopupAudio(audio)
  }

  return (
    <motion.aside
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="walkthrough-popup"
      data-placement={popupPosition.placement}
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      ref={popupRef}
      role="dialog"
      style={{
        left: popupPosition.left,
        top: popupPosition.top,
      }}
      tabIndex={-1}
      transition={{
        duration: 0.18,
        ease: 'easeOut',
      }}
    >
      <div className="walkthrough-popup__header">
        <div>
          <p className="walkthrough-popup__eyebrow">Guided Walkthrough</p>
          <h2 id={titleId}>{activeStep.title}</h2>
        </div>
      </div>

      <p className="walkthrough-popup__description" id={descriptionId}>
        {renderFormattedDescription(activeStep.description)}
      </p>

      <div className="walkthrough-popup__progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="walkthrough-popup__meta">
        <span aria-label={`Step ${currentStep} of ${totalSteps}`}>
          {currentStep} / {totalSteps}
        </span>

        <button
          aria-label={audioSource ? (isPlaying ? 'Pause audio narration' : 'Play audio narration') : 'Audio narration unavailable'}
          aria-pressed={audioSource ? isPlaying : undefined}
          className="walkthrough-popup__audio"
          disabled={!audioSource}
          onClick={toggleAudio}
          type="button"
        >
          <span aria-hidden="true">{isPlaying ? 'Pause' : 'Audio'}</span>
        </button>
      </div>

      <div className={`walkthrough-popup__actions ${canGoNext ? '' : 'walkthrough-popup__actions--final'}`}>
        <button
          className="walkthrough-popup__button walkthrough-popup__button--secondary"
          disabled={!canGoPrevious}
          onClick={onPrevious}
          type="button"
        >
          Previous
        </button>
        <button
          className={secondaryActionClassName}
          data-autofocus={canGoNext ? undefined : true}
          onClick={handleSecondaryAction}
          type="button"
        >
          {secondaryActionLabel}
        </button>
        {canGoNext ? (
          <button
            className="walkthrough-popup__button walkthrough-popup__button--primary"
            data-autofocus
            onClick={onNext}
            type="button"
          >
            Next
          </button>
        ) : null}
      </div>
    </motion.aside>
  )
}

export default WalkthroughPopup
