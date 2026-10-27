const SIMULATION_AUDIO_BASE_PATH = '/simulation-audios/'

export const simulationAudioUrl = (fileName) => (
  `${SIMULATION_AUDIO_BASE_PATH}${encodeURIComponent(fileName).replace(/%2C/gi, ',')}`
)

export const SIMULATION_AUDIO = {
  afterVoltageSet: simulationAudioUrl('After Voltage is set.wav'),
  aiGuideClick: simulationAudioUrl('AI Guide click.wav'),
  allGuideConnectionsComplete: simulationAudioUrl('Guide all complete conn.wav'),
  autoConnect: simulationAudioUrl('Autoconnect.wav'),
  autotransformerBlocked: simulationAudioUrl('Autotransformer click after check disabled.wav'),
  beforeConnectionMcbAlert: simulationAudioUrl('Before connection, on-click MCB Alert.wav'),
  correctConnections: simulationAudioUrl('Correct Connections.wav'),
  duplicateReading: simulationAudioUrl('Duplicate Readings.wav'),
  fifthReadingAdded: simulationAudioUrl('5th readings added.wav'),
  firstCheckClick: simulationAudioUrl('1st time check button click.wav'),
  firstReadingAdded: simulationAudioUrl('1st readings added.wav'),
  firstSwitchOn: simulationAudioUrl('First Switch ON.wav'),
  firstTimeAutotransformerClick: simulationAudioUrl('1st time autotransformer click.wav'),
  forCorrectConnectionsCheckClick: simulationAudioUrl('For correct connections, check click.wav'),
  fourthReadingAdded: simulationAudioUrl('4th readings added.wav'),
  fourthSwitchOn: simulationAudioUrl('Fourth Switch ON.wav'),
  generateReportClick: simulationAudioUrl('Generate Report button click.wav'),
  graphPlotted: simulationAudioUrl('Graphs Plotted Successfully.wav'),
  mcbOn: simulationAudioUrl('MCB ON.wav'),
  multipleWrongConnections: simulationAudioUrl('Multiple wrong connections.wav'),
  nextConnection: simulationAudioUrl("Let's move on to the next connection.wav"),
  print: simulationAudioUrl('Print.wav'),
  reset: simulationAudioUrl('Reset.wav'),
  secondReadingAdded: simulationAudioUrl('2nd readings added.wav'),
  secondSwitchOn: simulationAudioUrl('Second Switch ON.wav'),
  thirdReadingAdded: simulationAudioUrl('3rd readings added.wav'),
  thirdSwitchOn: simulationAudioUrl('Third Switch ON.wav'),
  walkthroughComplete: simulationAudioUrl('The interface walkthrough is now complete.wav'),
  wrongConnection: simulationAudioUrl('Wrong connection.wav'),
}

// The current terminal pairs use the guide's text-to-speech narration.
export const CONNECTION_AUDIO_BY_LABEL = {}
