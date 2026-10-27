import { useMemo } from 'react'

const EMPTY_GRAPH_DATA = {
  speed: [],
  power: [],
}
const CHART_VIEWBOX = {
  height: 286,
  width: 650,
}
const PLOT = {
  height: 176,
  left: 80,
  top: 36,
  width: 520,
}
const POINT_TOOLTIP = {
  gap: 12,
  height: 28,
  margin: 6,
  width: 132,
}
const TICK_COUNT = 5

const toNumericValue = (value) => {
  const numericValue = Number.parseFloat(String(value).replace(/,/g, '').trim())

  return Number.isFinite(numericValue) ? numericValue : undefined
}

const readGraphPoints = (observations, valueKey) => (
  observations
    .map((row) => {
      const torque = toNumericValue(row.torque)
      const value = toNumericValue(row[valueKey])

      if (!Number.isFinite(torque) || !Number.isFinite(value)) {
        return null
      }

      return { torque, value }
    })
    .filter(Boolean)
    .sort((current, next) => current.torque - next.torque)
)

const getGraphData = (observations) => ({
  speed: readGraphPoints(observations, 'speed'),
  power: readGraphPoints(observations, 'power'),
})

const getNiceStep = (roughStep) => {
  if (roughStep <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const niceStep = (
    normalizedStep <= 1 ? 1
      : normalizedStep <= 2 ? 2
        : normalizedStep <= 2.5 ? 2.5
          : normalizedStep <= 5 ? 5
            : 10
  )

  return niceStep * magnitude
}

const getNiceMaximum = (values) => {
  const maxValue = Math.max(0, ...values)
  const paddedMax = maxValue > 0 ? maxValue * 1.08 : 1
  const step = getNiceStep(paddedMax / (TICK_COUNT - 1))

  return step * (TICK_COUNT - 1)
}

const getTicks = (maxValue) => (
  Array.from({ length: TICK_COUNT }, (_, index) => (
    (maxValue / (TICK_COUNT - 1)) * index
  ))
)

const formatAxisTick = (value) => {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0)
  }

  return value.toFixed(1).replace(/\.0$/, '')
}

const formatCoordinateValue = (value) => (
  value.toFixed(2).replace(/\.?0+$/, '')
)

const getChartPoint = (point, xMax, yMax) => ({
  ...point,
  x: PLOT.left + (point.torque / xMax) * PLOT.width,
  y: PLOT.top + PLOT.height - (point.value / yMax) * PLOT.height,
})

const getPointTooltipPosition = (point) => {
  const x = Math.min(
    Math.max(point.x - POINT_TOOLTIP.width / 2, POINT_TOOLTIP.margin),
    CHART_VIEWBOX.width - POINT_TOOLTIP.width - POINT_TOOLTIP.margin,
  )
  const yAbove = point.y - POINT_TOOLTIP.height - POINT_TOOLTIP.gap
  const y = yAbove >= POINT_TOOLTIP.margin
    ? yAbove
    : Math.min(
      point.y + POINT_TOOLTIP.gap,
      CHART_VIEWBOX.height - POINT_TOOLTIP.height - POINT_TOOLTIP.margin,
    )

  return { x, y }
}

const getSmoothPath = (points) => {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  }

  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point
    const next = points[index + 1]
    const afterNext = points[index + 2] ?? next
    const controlOneX = point.x + (next.x - previous.x) / 6
    const controlOneY = point.y + (next.y - previous.y) / 6
    const controlTwoX = next.x - (afterNext.x - point.x) / 6
    const controlTwoY = next.y - (afterNext.y - point.y) / 6

    return `${path} C${controlOneX.toFixed(1)} ${controlOneY.toFixed(1)}, ${controlTwoX.toFixed(1)} ${controlTwoY.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }, `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`)
}

const ResultsLineChart = ({
  color,
  id,
  points,
  softColor,
  title,
  yAxisLabel,
}) => {
  const chartRight = PLOT.left + PLOT.width
  const chartBottom = PLOT.top + PLOT.height
  const xMax = getNiceMaximum(points.map((point) => point.torque))
  const yMax = getNiceMaximum(points.map((point) => point.value))
  const xTicks = getTicks(xMax)
  const yTicks = getTicks(yMax)
  const chartPoints = points.map((point) => getChartPoint(point, xMax, yMax))
  const linePath = getSmoothPath(chartPoints)
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const clipId = `${chartId}-clip`

  return (
    <article
      className="results-graph-card"
      id={id}
      style={{
        '--results-graph-color': color,
        '--results-graph-soft-color': softColor,
      }}
    >
      <h3>{title}</h3>
      <svg
        aria-label={title}
        className="results-graph-card__chart"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect height={PLOT.height} width={PLOT.width} x={PLOT.left} y={PLOT.top} />
          </clipPath>
        </defs>

        <rect className="results-graph__plot-bg" height={PLOT.height} width={PLOT.width} x={PLOT.left} y={PLOT.top} />

        {xTicks.map((tick) => {
          const x = PLOT.left + (tick / xMax) * PLOT.width

          return (
            <g key={`x-${tick}`}>
              <line className="results-graph__grid-line" x1={x} x2={x} y1={PLOT.top} y2={chartBottom} />
              <line className="results-graph__tick-line" x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} />
              <text className="results-graph__tick-label" textAnchor="middle" x={x} y={chartBottom + 24}>{formatAxisTick(tick)}</text>
            </g>
          )
        })}

        {yTicks.map((tick) => {
          const y = PLOT.top + PLOT.height - (tick / yMax) * PLOT.height

          return (
            <g key={`y-${tick}`}>
              <line className="results-graph__grid-line results-graph__grid-line--horizontal" x1={PLOT.left} x2={chartRight} y1={y} y2={y} />
              <line className="results-graph__tick-line" x1={PLOT.left - 6} x2={PLOT.left} y1={y} y2={y} />
              <text className="results-graph__tick-label results-graph__tick-label--y" textAnchor="end" x={PLOT.left - 12} y={y + 4}>{formatAxisTick(tick)}</text>
            </g>
          )
        })}

        <path className="results-graph__axis-line" d={`M${PLOT.left} ${chartBottom}H${chartRight}`} />
        <path className="results-graph__axis-line" d={`M${PLOT.left} ${chartBottom}V${PLOT.top}`} />

        <text className="results-graph__axis-title" textAnchor="middle" x={PLOT.left + PLOT.width / 2} y={CHART_VIEWBOX.height - 10}>
          Torque (N·m)
        </text>
        <text
          className="results-graph__axis-title"
          textAnchor="middle"
          transform={`rotate(-90 24 ${PLOT.top + PLOT.height / 2})`}
          x="24"
          y={PLOT.top + PLOT.height / 2}
        >
          {yAxisLabel}
        </text>

        <g clipPath={`url(#${clipId})`}>
          {linePath ? <path className="results-graph__line" d={linePath} /> : null}
        </g>

        {chartPoints.map((point, index) => {
          const tooltip = getPointTooltipPosition(point)
          const torqueText = formatCoordinateValue(point.torque)
          const valueText = formatCoordinateValue(point.value)
          const coordinateText = `(${torqueText}, ${valueText})`
          const coordinateLabel = `Point coordinates ${coordinateText}`

          return (
            <g
              aria-label={coordinateLabel}
              className="results-graph__point-marker"
              key={`${title}-${point.torque}-${point.value}-${index}`}
              tabIndex="0"
            >
              <circle className="results-graph__point-hit" cx={point.x} cy={point.y} r="10" />
              <circle className="results-graph__point" cx={point.x} cy={point.y} r="4.8" />
              <g className="results-graph__point-tooltip">
                <rect
                  className="results-graph__point-tooltip-bg"
                  height={POINT_TOOLTIP.height}
                  rx="5"
                  width={POINT_TOOLTIP.width}
                  x={tooltip.x}
                  y={tooltip.y}
                />
                <text
                  className="results-graph__point-tooltip-text"
                  textAnchor="middle"
                  x={tooltip.x + POINT_TOOLTIP.width / 2}
                  y={tooltip.y + 18}
                >
                  <tspan>{coordinateText}</tspan>
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </article>
  )
}

function drawSpeedGraph(points) {
  return (
    <ResultsLineChart
      color="#0f766e"
      id="speed-graph-card"
      points={points}
      softColor="#d9f5f0"
      title="Speed vs Torque"
      yAxisLabel="Speed (RPM)"
    />
  )
}

function drawPowerGraph(points) {
  return (
    <ResultsLineChart
      color="#b45309"
      id="power-graph-card"
      points={points}
      softColor="#fff1d6"
      title="Total Input Power vs Torque"
      yAxisLabel="Total Input Power (kW)"
    />
  )
}

const ResultsGraphs = ({ minReadings = 0, observations = [], plotted = false }) => {
  const shouldPlot = plotted && observations.length >= minReadings
  const graphData = useMemo(
    () => (shouldPlot ? getGraphData(observations) : EMPTY_GRAPH_DATA),
    [observations, shouldPlot],
  )

  return (
    <section className="results-graphs-panel" id="results-graphs-panel" aria-label="Experiment result graphs">
      <div className="results-graphs-panel__heading">
        <h2>GRAPHS</h2>
      </div>
      <div className="results-graphs-grid">
        {drawSpeedGraph(graphData.speed)}
        {drawPowerGraph(graphData.power)}
      </div>
    </section>
  )
}

export default ResultsGraphs
