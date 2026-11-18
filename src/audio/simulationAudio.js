import aiGuideConfig from '../aiGuide/aiGuideConfig.json'
import allGuideConnectionsComplete from './Guide all complete conn.wav'
import autoConnect from './Autoconnect.wav'
import beforeConnectionMcbAlert from './Before connection, on-click MCB Alert.wav'
import firstCheckClick from './1st time check button click.wav'
import forCorrectConnectionsCheckClick from './For correct connections, check click.wav'
import wrongConnection from './Wrong connection.wav'

const motorAudioFiles = import.meta.glob('./*.wav', {
  eager: true,
  import: 'default',
  query: '?url',
})

export const simulationAudioUrl = (fileName) => (
  motorAudioFiles[`./${fileName}`]
  ?? `${import.meta.env.BASE_URL}simulation-audios/${encodeURIComponent(fileName).replace(/%2C/gi, ',')}`
)

export const SIMULATION_MESSAGES = aiGuideConfig.messages

export const SIMULATION_AUDIO = {
  afterVoltageSet: simulationAudioUrl('After Voltage is set.wav'),
  aiGuideClick: simulationAudioUrl('AI Guide click.wav'),
  allGuideConnectionsComplete,
  autoConnect,
  autotransformerBlocked: simulationAudioUrl('Autotransformer click after check disabled.wav'),
  beforeConnectionMcbAlert,
  duplicateReading: simulationAudioUrl('Duplicate Readings.wav'),
  firstCheckClick,
  firstHandClick: simulationAudioUrl('1st hand icon click.wav'),
  firstReadingAdded: simulationAudioUrl('1st reading added.wav'),
  firstTimeAutotransformerClick: simulationAudioUrl('1st time autotransformer click.wav'),
  forCorrectConnectionsCheckClick,
  generateReportClick: simulationAudioUrl('Generate Report button click.wav'),
  graphPlotted: simulationAudioUrl('Graph Plotted Successfully.wav'),
  mcbOn: simulationAudioUrl('MCB ON.wav'),
  multipleWrongConnections: simulationAudioUrl('Multiple wrong connections.wav'),
  nextConnection: simulationAudioUrl("Let's move on to the next connection.wav"),
  print: simulationAudioUrl('Print.wav'),
  reset: simulationAudioUrl('Reset.wav'),
  secondHandClick: simulationAudioUrl('2nd hand icon click.wav'),
  secondReadingAdded: simulationAudioUrl('2nd reading added.wav'),
  sixthReadingAdded: simulationAudioUrl('6th reading added.wav'),
  thirdReadingAdded: simulationAudioUrl('3rd reading added.wav'),
  walkthroughComplete: simulationAudioUrl('The interface walkthrough is now complete.wav'),
  wrongConnection,
}

export const CONNECTION_AUDIO_BY_LABEL = {
  '1-4': simulationAudioUrl('Click and drag the wire from terminal 1 and drop it on terminal 4. .wav'),
  '2-5': simulationAudioUrl('Connect terminal 2 to terminal 5..wav'),
  '3-6': simulationAudioUrl('Connect terminal 3 to terminal 6.wav'),
  '7-10': simulationAudioUrl('Connect terminal 7 to terminal 10. -.wav'),
  '8-11': simulationAudioUrl('Connect terminal 8 to terminal 11.wav'),
  '9-12': simulationAudioUrl('Connect terminal 9 to terminal 12.wav'),
  '7-16': simulationAudioUrl('Connect terminal 7 to terminal 16.wav'),
  '8-17': simulationAudioUrl('Connect terminal 8 to terminal 17.wav'),
  '9-18': simulationAudioUrl('Connect terminal 9 to terminal 18..wav'),
  '13 → loop on 7-16': simulationAudioUrl('Connect terminal 13 to the loop on 7-16.wav'),
  '14 → loop on 8-17': simulationAudioUrl('Connect terminal 14 to the loop on 8-17.wav'),
  '15 → loop on 9-18': simulationAudioUrl('Connect terminal 15 to the loop on 9-18.wav'),
}
