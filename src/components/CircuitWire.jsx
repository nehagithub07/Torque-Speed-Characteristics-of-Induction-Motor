const CircuitWire = ({ className = '', d, stroke, ...attributes }) => (
  <g className="circuit-wire-bundle" stroke={stroke}>
    <path className={`circuit-wire-outline ${className}`} d={d} />
    <path {...attributes} className={`circuit-wire ${className}`} d={d} />
  </g>
)

export default CircuitWire
