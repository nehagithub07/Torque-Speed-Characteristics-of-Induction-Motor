import PowerSupply from './PowerSupply.jsx'
import PowerAnalyser from './PowerAnalyser.jsx'
import RpmMeter from './RpmMeter.jsx'
import Pulley from './Pulley.jsx'
import Variac from './Variac.jsx'

const EquipmentPanel = ({
  onTogglePower,
  onVoltageControlBlocked,
  powerOn,
  setVoltage,
  voltage,
  loadLevel, turning, canIncreaseLoad, readingsReady, reading,
  onIncreaseLoad, onTurningChange,
}) => (
  <section className="equipment-panel" id="equipment-panel">
    <PowerSupply
      onTogglePower={onTogglePower}
      powerOn={powerOn}
    />
    <RpmMeter reading={reading} readingsReady={readingsReady} />
    <PowerAnalyser powerOn={powerOn} reading={reading} readingsReady={readingsReady} />
    <Variac
      onBlockedControl={onVoltageControlBlocked}
      powerOn={powerOn}
      setVoltage={setVoltage}
      voltage={voltage}
    />
    <Pulley
      loadLevel={loadLevel} turning={turning} canIncreaseLoad={canIncreaseLoad}
      onIncreaseLoad={onIncreaseLoad}
      onTurningChange={onTurningChange}
    />
  </section>
)

export default EquipmentPanel
