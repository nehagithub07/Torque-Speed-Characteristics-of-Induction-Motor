import { useCallback, useEffect, useMemo, useState } from 'react'

import defaultWalkthroughConfig from './walkthroughConfig.json'
import { WalkthroughContext } from './WalkthroughContext.js'
import { loadWalkthroughConfig } from './walkthroughConfigLoader.js'
import WalkthroughOverlay from './components/WalkthroughOverlay.jsx'
import './walkthrough.css'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getElementRect = (element) => {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

const WalkthroughProvider = ({
  autoPlayAudio = false,
  children,
  config = defaultWalkthroughConfig,
  locale,
}) => {
  const walkthroughConfig = useMemo(
    () => loadWalkthroughConfig(config, locale ?? config?.defaultLocale),
    [config, locale],
  )
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPositioningTarget, setIsPositioningTarget] = useState(false)
  const [targetRect, setTargetRect] = useState(null)

  const totalSteps = walkthroughConfig.steps.length
  const activeStep = isOpen ? walkthroughConfig.steps[currentStepIndex] : null
  const activeTargetSelector = activeStep?.target
  const currentStep = currentStepIndex + 1
  const canGoPrevious = currentStepIndex > 0
  const canGoNext = currentStepIndex < totalSteps - 1
  const autoPlayAudioForStep = Boolean(
    activeStep?.autoplayAudio
    ?? walkthroughConfig.audio?.autoplay
    ?? autoPlayAudio
  )

  const readActiveTarget = useCallback(() => {
    if (!activeTargetSelector) {
      setTargetRect(null)
      return null
    }

    const target = document.querySelector(activeTargetSelector)
    const nextRect = getElementRect(target)

    setTargetRect(nextRect)

    return target
  }, [activeTargetSelector])

  const moveToStep = useCallback((stepIndex) => {
    if (totalSteps === 0) {
      return
    }

    setTargetRect(null)
    setIsPositioningTarget(true)
    setCurrentStepIndex(clamp(stepIndex, 0, totalSteps - 1))
  }, [totalSteps])

  const start = useCallback((stepIndex = 0) => {
    moveToStep(stepIndex)
    setIsOpen(true)
  }, [moveToStep])

  const close = useCallback(() => {
    setIsOpen(false)
    setIsPositioningTarget(false)
    setTargetRect(null)
  }, [])

  const next = useCallback(() => {
    moveToStep(currentStepIndex + 1)
  }, [currentStepIndex, moveToStep])

  const previous = useCallback(() => {
    moveToStep(currentStepIndex - 1)
  }, [currentStepIndex, moveToStep])

  const skipToLastStep = useCallback(() => {
    moveToStep(totalSteps - 1)
  }, [moveToStep, totalSteps])

  const goToStep = useCallback((stepIndex) => {
    moveToStep(stepIndex)
  }, [moveToStep])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior
    const previousDocumentOverflow = documentElement.style.overflow
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior

    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    documentElement.style.overflow = 'hidden'
    documentElement.style.overscrollBehavior = 'none'

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
      documentElement.style.overflow = previousDocumentOverflow
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !activeTargetSelector) {
      return undefined
    }

    const target = document.querySelector(activeTargetSelector)

    target?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
      inline: 'center',
    })

    let secondAnimationFrame = null
    const animationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(() => {
        readActiveTarget()
        setIsPositioningTarget(false)
      })
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (secondAnimationFrame) {
        window.cancelAnimationFrame(secondAnimationFrame)
      }
    }
  }, [activeTargetSelector, isOpen, readActiveTarget])

  useEffect(() => {
    if (!isOpen || isPositioningTarget) {
      return undefined
    }

    let animationFrame = null

    const scheduleRefresh = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(readActiveTarget)
    }

    window.addEventListener('resize', scheduleRefresh)
    window.visualViewport?.addEventListener('resize', scheduleRefresh)

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      window.removeEventListener('resize', scheduleRefresh)
      window.visualViewport?.removeEventListener('resize', scheduleRefresh)
    }
  }, [isOpen, isPositioningTarget, readActiveTarget])

  useEffect(() => {
    if (!isOpen || !activeTargetSelector) {
      return undefined
    }

    const target = document.querySelector(activeTargetSelector)

    if (!target) {
      return undefined
    }

    target.classList.add('walkthrough-active-target')

    return () => {
      target.classList.remove('walkthrough-active-target')
    }
  }, [activeTargetSelector, isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault()
        next()
        return
      }

      if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault()
        previous()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoNext, canGoPrevious, isOpen, next, previous])

  const contextValue = useMemo(() => ({
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    config: walkthroughConfig,
    currentStep,
    currentStepIndex,
    experimentName: walkthroughConfig.experimentName,
    goToStep,
    isOpen,
    isPositioningTarget,
    locale: walkthroughConfig.locale,
    next,
    previous,
    skipToLastStep,
    start,
    targetRect,
    totalSteps,
  }), [
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    currentStep,
    currentStepIndex,
    goToStep,
    isOpen,
    isPositioningTarget,
    next,
    previous,
    skipToLastStep,
    start,
    targetRect,
    totalSteps,
    walkthroughConfig,
  ])

  return (
    <WalkthroughContext.Provider value={contextValue}>
      {children}
      <WalkthroughOverlay />
    </WalkthroughContext.Provider>
  )
}

export default WalkthroughProvider
