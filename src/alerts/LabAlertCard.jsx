import { useCallback, useEffect, useRef, useState } from 'react'

import { stopExclusiveAudio } from '../audio/exclusiveAudio.js'

const EXIT_DURATION = 180

const dispatchLabAlertEvent = (eventName, detail) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

const LabAlertCard = ({ alert, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false)
  const dismissTimerRef = useRef(null)
  const {
    canGoNext,
    canGoPrevious,
    confirmLabel = 'OK',
    description,
    duration,
    icon,
    id,
    onConfirm,
    onNarration,
    onNext,
    onPrevious,
    placement,
    requiresConfirmation,
    title,
    tutorialMode,
    type,
  } = alert
  const hasProgressTimer = !requiresConfirmation && Number.isFinite(duration) && duration > 0
  const titleId = `lab-alert-title-${id}`
  const descriptionId = `lab-alert-description-${id}`
  const role = type === 'error' || type === 'warning' ? 'alert' : 'status'
  const showNarration = Boolean(alert.audioNarration || alert.narration || onNarration)
  const showTutorialControls = Boolean(tutorialMode || onNext || onPrevious)

  const dismiss = useCallback((reason = 'dismiss', callClose = true) => {
    if (isClosing) {
      return
    }

    setIsClosing(true)

    dismissTimerRef.current = window.setTimeout(() => {
      if (callClose) {
        alert.onClose?.(reason, alert)
      }

      onDismiss(id)
    }, EXIT_DURATION)
  }, [alert, id, isClosing, onDismiss])

  useEffect(() => {
    dispatchLabAlertEvent('lab-alert:sound', {
      id,
      sound: alert.sound ?? type,
      title,
      type,
    })
  }, [alert.sound, id, title, type])

  useEffect(() => {
    if (!hasProgressTimer) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      dismiss('timeout')
    }, duration)

    return () => window.clearTimeout(timer)
  }, [dismiss, duration, hasProgressTimer])

  useEffect(() => () => {
    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const handleConfirm = () => {
    stopExclusiveAudio()
    onConfirm?.(alert)
    dismiss('confirm', false)
  }

  const handleOk = () => {
    stopExclusiveAudio()
    dismiss('ok')
  }

  const handleClose = () => {
    stopExclusiveAudio()
    dismiss('close')
  }

  const handleNarration = () => {
    onNarration?.(alert)
    dispatchLabAlertEvent('lab-alert:narration', {
      id,
      narration: alert.narration ?? `${title}. ${description ?? ''}`.trim(),
      title,
      type,
    })
  }

  return (
    <article
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={`lab-alert-card lab-alert-card--${type} ${isClosing ? 'lab-alert-card--closing' : ''}`}
      data-placement={placement}
      role={role}
      style={{ '--alert-duration': `${duration ?? 0}ms` }}
    >
      <div className="lab-alert-card__glow" aria-hidden="true" />

      <div className="lab-alert-card__main">
        <span className="lab-alert-card__icon" aria-hidden="true">{icon}</span>

        <div className="lab-alert-card__content">
          <div className="lab-alert-card__meta">
            <span>{type.toUpperCase()}</span>
          </div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>

        <div className="lab-alert-card__tools">
          {showNarration ? (
            <button
              aria-label="Play alert narration"
              className="lab-alert-card__icon-button"
              onClick={handleNarration}
              type="button"
            >
              🔊
            </button>
          ) : null}
          <button
            aria-label="Close alert"
            className="lab-alert-card__icon-button"
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </div>
      </div>

      <div className="lab-alert-card__actions">
        {showTutorialControls ? (
          <>
            <button
              className="lab-alert-card__button lab-alert-card__button--secondary"
              disabled={canGoPrevious === false}
              onClick={onPrevious}
              type="button"
            >
              Previous
            </button>
            <button
              className="lab-alert-card__button lab-alert-card__button--secondary"
              disabled={canGoNext === false}
              onClick={onNext}
              type="button"
            >
              Next
            </button>
          </>
        ) : null}

        <button
          className="lab-alert-card__button lab-alert-card__button--primary"
          onClick={requiresConfirmation ? handleConfirm : handleOk}
          type="button"
        >
          {requiresConfirmation ? confirmLabel : 'OK'}
        </button>
      </div>

      {hasProgressTimer ? (
        <div className="lab-alert-card__timer" aria-hidden="true">
          <span />
        </div>
      ) : null}

    </article>
  )
}

export default LabAlertCard
