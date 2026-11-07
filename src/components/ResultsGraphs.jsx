import {
  TORQUE_SPEED_AXES,
  getTorqueSpeedPath,
  getTorqueSpeedPoints,
  getTorqueSpeedPosition,
} from '../utils/torqueSpeedGraph.js'

const CHART_VIEWBOX = { width: 1300, height: 286 }
const PLOT = { left: 80, top: 25, width: 1180, height: 190 }
const POINT_TOOLTIP = { gap: 12, height: 28, margin: 6, width: 132 }

const getPointTooltipPosition = point => {
  const x = Math.min(
    Math.max(point.x - POINT_TOOLTIP.width / 2, POINT_TOOLTIP.margin),
    CHART_VIEWBOX.width - POINT_TOOLTIP.width - POINT_TOOLTIP.margin,
  )
  const yAbove = point.y - POINT_TOOLTIP.height - POINT_TOOLTIP.gap
  const y = yAbove >= POINT_TOOLTIP.margin ? yAbove : point.y + POINT_TOOLTIP.gap
  return { x, y }
}

const ResultsGraphs = ({ minReadings = 0, observations = [], plotted = false }) => {
  const shouldPlot = plotted && observations.length >= minReadings
  const points = shouldPlot ? getTorqueSpeedPoints(observations) : []
  const chartPoints = points.map(point => getTorqueSpeedPosition(point, PLOT))
  const linePath = getTorqueSpeedPath(chartPoints)
  const chartRight = PLOT.left + PLOT.width
  const chartBottom = PLOT.top + PLOT.height

  return (
    <section className="results-graphs-panel" id="results-graphs-panel" aria-label="Experiment result graph">
      <div className="results-graphs-panel__heading"><h2>GRAPH</h2></div>
      <div className="results-graphs-grid">
        <article
          className="results-graph-card"
          id="torque-speed-graph-card"
          style={{ '--results-graph-color': '#0f766e', '--results-graph-soft-color': '#d9f5f0' }}
        >
          <h3>Torque vs Speed</h3>
          <svg
            aria-label="Torque (N-m) versus Speed (RPM); speed on the X-axis and torque on the Y-axis"
            className="results-graph-card__chart"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            viewBox={`0 0 ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
          >
            <defs>
              <clipPath id="torque-speed-clip">
                <rect height={PLOT.height} width={PLOT.width} x={PLOT.left} y={PLOT.top} />
              </clipPath>
            </defs>
            <rect className="results-graph__plot-bg" height={PLOT.height} width={PLOT.width} x={PLOT.left} y={PLOT.top} />
            {TORQUE_SPEED_AXES.speedTicks.map(speed => {
              const { x } = getTorqueSpeedPosition({ speed, torque: 0 }, PLOT)
              return (
                <g key={`x-${speed}`}>
                  <line className="results-graph__grid-line" x1={x} x2={x} y1={PLOT.top} y2={chartBottom} />
                  <line className="results-graph__tick-line" x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} />
                  <text className="results-graph__tick-label" textAnchor="middle" x={x} y={chartBottom + 24}>{speed}</text>
                </g>
              )
            })}
            {TORQUE_SPEED_AXES.torqueTicks.map(torque => {
              const { y } = getTorqueSpeedPosition({ speed: TORQUE_SPEED_AXES.speedMin, torque }, PLOT)
              return (
                <g key={`y-${torque}`}>
                  <line className="results-graph__grid-line results-graph__grid-line--horizontal" x1={PLOT.left} x2={chartRight} y1={y} y2={y} />
                  <line className="results-graph__tick-line" x1={PLOT.left - 6} x2={PLOT.left} y1={y} y2={y} />
                  <text className="results-graph__tick-label results-graph__tick-label--y" textAnchor="end" x={PLOT.left - 12} y={y + 4}>{torque}</text>
                </g>
              )
            })}
            <path className="results-graph__axis-line" d={`M${PLOT.left} ${chartBottom}H${chartRight}`} />
            <path className="results-graph__axis-line" d={`M${PLOT.left} ${chartBottom}V${PLOT.top}`} />
            <text className="results-graph__axis-title" textAnchor="middle" x={PLOT.left + PLOT.width / 2} y={CHART_VIEWBOX.height - 10}>
              Speed (RPM)
            </text>
            <text className="results-graph__axis-title" textAnchor="middle" transform={`rotate(-90 24 ${PLOT.top + PLOT.height / 2})`} x="24" y={PLOT.top + PLOT.height / 2}>
              Torque (N-m)
            </text>
            <g clipPath="url(#torque-speed-clip)">
              {linePath && <path className="results-graph__line" d={linePath} />}
            </g>
            {chartPoints.map(point => {
              const tooltip = getPointTooltipPosition(point)
              return (
                <g
                  aria-label={`Speed ${point.speed} RPM, Torque ${point.torque} N-m`}
                  className="results-graph__point-marker"
                  key={`${point.speed}-${point.torque}`}
                  tabIndex="0"
                >
                  <circle className="results-graph__point-hit" cx={point.x} cy={point.y} r="10" />
                  <circle className="results-graph__point" cx={point.x} cy={point.y} r="4.8" />
                  <g className="results-graph__point-tooltip">
                    <rect className="results-graph__point-tooltip-bg" height={POINT_TOOLTIP.height} rx="5" width={POINT_TOOLTIP.width} x={tooltip.x} y={tooltip.y} />
                    <text className="results-graph__point-tooltip-text" textAnchor="middle" x={tooltip.x + POINT_TOOLTIP.width / 2} y={tooltip.y + 18}>
                      ({point.speed}, {point.torque})
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>
        </article>
      </div>
    </section>
  )
}

export default ResultsGraphs
