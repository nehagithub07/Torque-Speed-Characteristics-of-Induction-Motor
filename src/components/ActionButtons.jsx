import { useEffect, useRef, useState } from 'react'
import SectionCard from './SectionCard.jsx'
import { REQUIRED_CONNECTIONS, getConnectionLabel } from '../config/circuitConnections.js'
import {
  AddIcon,
  AiGuide,
  AutoConnectIcon,
  ButtonIcon,
  CheckIcon,
  CloseIcon,
  PlotIcon,
  PrintIcon,
  ResetIcon,
} from './Icons.jsx'

const buttons = [
  {
    id: 'instruction-button',
    label: 'INSTRUCTIONS',
    tone: 'action-button--gold',
    Icon: ButtonIcon,
    opensInstructions: true,
  },
  {
    id: 'ai-guide-button',
    label: 'AI GUIDE',
    tone: 'action-button--cyan',
    Icon: AiGuide,
    handlerName: 'onAiGuide',
  },
  {
    id: 'check-button',
    label: 'CHECK',
    tone: 'action-button--green',
    Icon: CheckIcon,
    handlerName: 'onCheck',
  },
  {
    id: 'auto-connect-button',
    label: 'AUTO CONNECT',
    tone: 'action-button--teal',
    Icon: AutoConnectIcon,
    handlerName: 'onAutoConnect',
  },
  {
    id: 'add-reading-button',
    label: 'ADD',
    tone: 'action-button--blue',
    Icon: AddIcon,
    handlerName: 'onAdd',
  },
  {
    id: 'plot-button',
    label: 'PLOT',
    tone: 'action-button--orange',
    Icon: PlotIcon,
    handlerName: 'onPlot',
  },
  {
    id: 'reset-button',
    label: 'RESET',
    tone: 'action-button--red',
    Icon: ResetIcon,
    handlerName: 'onReset',
  },
  {
    id: 'print-button',
    label: 'PRINT',
    tone: 'action-button--purple',
    Icon: PrintIcon,
    handlerName: 'onPrint',
  },
  
 
]

const connectionGroups = REQUIRED_CONNECTIONS.map(([source, target], index) => {
  const pair = getConnectionLabel(source, target)

  return {
    id: `instruction-connection-${pair}`,
    label: `Connection ${index + 1}:`,
    pairs: [pair],
  }
})

const instructionSteps = [
  {
    id: 'connections',
    title: 'STEP 1:',
    content: 'Drag between terminals, or select two terminals, to make the wires below. Then connect analyser ports 13, 14, and 15 to the circular targets on motor wires 7-16, 8-17, and 9-18. Drag from a port to its target, or select the port and then the target.',
    groups: connectionGroups,
  },
  {
    title: 'NOTE:',
    content: 'Click a terminal number to remove its connections. Numbers 13, 14, and 15 remove only their loops. Removing a motor wire also removes its attached loop.',
  },
  
  {
    id: 'check',
    title: 'STEP 2:',
    content: 'Click CHECK button to verify the connections. If any connection is incorrect or missing, correct the connections and check again.',
  },
  {
    id: 'mcb',
    title: 'STEP 3:',
    content: 'After the connections are correct, turn ON the MCB by clicking the MCB lever.',
  },
  {
    id: 'voltage',
    title: 'STEP 4:',
    content: 'Click the autotransformer knob to set the three-phase line voltage to 400 V. The analyser displays the phase voltages, phase currents, and total power at 50 Hz.',
  },
  {
    id: 'add',
    title: 'STEP 5:',
    content: 'Click ADD to record the displayed readings. Record the no-load condition first: W1 = 0 kg and W2 = 0 kg.',
  },
  {
    id: 'load',
    title: 'STEP 6:',
    content: 'Click the hand beside the pulley. It moves to the top handle and turns it to apply the next brake load. Wait for the hand to return, then click ADD. Repeat until all six readings are recorded.',
  },
  {
    id: 'finish',
    title: 'STEP 7:',
    content: 'Click PLOT to view speed and total input power against torque. Generate the report or click PRINT. RESET clears the readings, load, supply, and connections.',
  },
]

const ActionButtons = ({
  activeConnectionPair,
  activeButtons = {},
  activeInstructionStepId = 'connections',
  disabledButtons = {},
  onAdd,
  onAiGuide,
  onCheck,
  onPlot,
  onPrint,
  onReset,
  onAutoConnect,
}) => {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const activeInstructionRef = useRef(null)
  const handlers = {
    onAdd,
    onCheck,
    onPlot,
    onPrint,
    onReset,
    onAutoConnect,
    onAiGuide,
  }

  useEffect(() => {
    if (!instructionsOpen || !activeInstructionRef.current) {
      return
    }

    activeInstructionRef.current.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [activeConnectionPair, activeInstructionStepId, instructionsOpen])

  return (
    <SectionCard className="action-buttons-card h-[228px]" icon="buttons" id="action-buttons-panel" title="ACTION BUTTONS">
      <div className="action-buttons__grid">
        {buttons.map(({ id, label, tone, Icon, handlerName, opensInstructions }) => {
          const handler = handlers[handlerName]
          const isActive = !opensInstructions && Boolean(activeButtons[handlerName])
          const isDisabled = !opensInstructions && (!handler || disabledButtons[handlerName])
          const buttonProps = opensInstructions
            ? {
                'aria-controls': 'experiment-instructions-panel',
                'aria-expanded': instructionsOpen,
                onClick: () => setInstructionsOpen((current) => !current),
              }
            : {
                'aria-pressed': handlerName === 'onAiGuide' ? isActive : undefined,
                onClick: handler,
              }

          return (
            <button
              id={id}
              key={label}
              type="button"
              className={`action-button ${tone} ${isActive ? 'action-button--active' : ''}`}
              disabled={isDisabled}
              {...buttonProps}
            >
              <Icon />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {instructionsOpen ? (
        <div
          className="action-instructions-panel"
          id="experiment-instructions-panel"
          role="region"
          aria-labelledby="experiment-instructions-title"
        >
          <div className="action-instructions-panel__header">
            <h3 id="experiment-instructions-title">Instructions</h3>
            <button
              type="button"
              className="action-instructions-panel__close"
              aria-label="Close instructions"
              onClick={() => setInstructionsOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="action-instructions-panel__body">
            <ol className="action-instructions-panel__steps">
              {instructionSteps.map((step) => {
                const isActiveStep = step.id === activeInstructionStepId
                const hasActiveSubstep = Boolean(
                  step.groups?.some((group) => (
                    isActiveStep
                    && group.pairs.includes(activeConnectionPair)
                  )),
                )

                return (
                  <li
                    aria-current={isActiveStep ? 'step' : undefined}
                    className={`action-instructions-panel__step ${isActiveStep && !hasActiveSubstep ? 'action-instructions-panel__step--active' : ''}`}
                    key={step.id}
                    ref={isActiveStep && !hasActiveSubstep ? activeInstructionRef : undefined}
                  >
                    <strong>{step.title}</strong> {step.content}
                    {step.groups ? (
                      <ul className="action-instructions-panel__substeps">
                        {step.groups.map((group) => {
                          const isActiveSubstep = (
                            isActiveStep
                            && group.pairs.includes(activeConnectionPair)
                          )

                          return (
                            <li
                              aria-current={isActiveSubstep ? 'step' : undefined}
                              className={`action-instructions-panel__substep ${isActiveSubstep ? 'action-instructions-panel__substep--active' : ''}`}
                              key={group.id}
                              ref={isActiveSubstep ? activeInstructionRef : undefined}
                            >
                              <strong>{group.label}</strong>{' '}
                              <code>({group.pairs.join(', ')})</code>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
             
            </ol>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

export default ActionButtons
