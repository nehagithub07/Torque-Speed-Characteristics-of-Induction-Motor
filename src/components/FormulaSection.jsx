import SectionCard from './SectionCard.jsx'

const FormulaSection = () => (
  <SectionCard className="formula-section-card" icon="formula" id="formula-section-panel" title="FORMULA">
    <div className="formula-section motor-torque-formula">
      <strong>T = (W1 − W2) × r × 9.81 N·m</strong>
      <p>r = brake drum radius = <b>0.075 m</b></p>
      <p>W1, W2 = spring balance readings in kg</p>
    </div>
  </SectionCard>
)

export default FormulaSection
