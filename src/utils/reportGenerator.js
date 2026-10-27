import { LINE_VOLTAGE, SUPPLY_FREQUENCY, BRAKE_DRUM_RADIUS, MOTOR_LOAD_READINGS, OBSERVATION_COLUMNS } from './motorLoadReadings.js'

const GRAPH_VIEWBOX = {
  height: 286,
  width: 650,
}
const GRAPH_PLOT = {
  height: 176,
  left: 80,
  top: 36,
  width: 520,
}
const GRAPH_TICK_COUNT = 5
const OBSERVATION_ROW_COUNT = MOTOR_LOAD_READINGS.length
const emptyObservationRows = Array.from({ length: OBSERVATION_ROW_COUNT })

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const toNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

const toOptionalNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : undefined
}

const formatNumber = (value, fractionDigits = 1) => (
  toNumber(value).toFixed(fractionDigits)
)

const formatObservationNumber = (value, digits) => (
  Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : ''
)

const formatTick = (value) => {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0)
  }

  return value.toFixed(1).replace(/\.0$/, '')
}

const getSessionDurationText = (sessionStart, sessionEnd) => {
  const durationMs = Math.max(0, sessionEnd - sessionStart)
  const durationTotalSeconds = Math.floor(durationMs / 1000)
  const durationMinutes = Math.floor(durationTotalSeconds / 60)
  const durationSeconds = durationTotalSeconds % 60

  return `${durationMinutes} min ${String(durationSeconds).padStart(2, '0')} sec`
}

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
  const step = getNiceStep(paddedMax / (GRAPH_TICK_COUNT - 1))

  return step * (GRAPH_TICK_COUNT - 1)
}

const getTicks = (maxValue) => (
  Array.from({ length: GRAPH_TICK_COUNT }, (_, index) => (
    (maxValue / (GRAPH_TICK_COUNT - 1)) * index
  ))
)

const getGraphData = (observations, valueKey) => (
  observations
    .map((row) => {
      const torque = toOptionalNumber(row.torque)
      const value = toOptionalNumber(row[valueKey])

      if (!Number.isFinite(torque) || !Number.isFinite(value)) {
        return null
      }

      return { torque, value }
    })
    .filter(Boolean)
    .sort((current, next) => current.torque - next.torque)
)

const getChartPoint = (point, xMax, yMax) => ({
  ...point,
  x: GRAPH_PLOT.left + (point.torque / xMax) * GRAPH_PLOT.width,
  y: GRAPH_PLOT.top + GRAPH_PLOT.height - (point.value / yMax) * GRAPH_PLOT.height,
})

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

const createReportGraphSvg = ({
  ariaLabel,
  color,
  points,
  title,
  yAxisLabel,
}) => {
  if (!points.length) {
    return '<em>No valid readings available to plot.</em>'
  }

  const chartRight = GRAPH_PLOT.left + GRAPH_PLOT.width
  const chartBottom = GRAPH_PLOT.top + GRAPH_PLOT.height
  const xMax = getNiceMaximum(points.map((point) => point.torque))
  const yMax = getNiceMaximum(points.map((point) => point.value))
  const xTicks = getTicks(xMax)
  const yTicks = getTicks(yMax)
  const chartPoints = points.map((point) => getChartPoint(point, xMax, yMax))
  const linePath = getSmoothPath(chartPoints)
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const clipId = `${chartId}-clip`

  const xTickMarkup = xTicks.map((tick) => {
    const x = GRAPH_PLOT.left + (tick / xMax) * GRAPH_PLOT.width

    return `
      <g>
        <line class="report-graph__grid" x1="${x}" x2="${x}" y1="${GRAPH_PLOT.top}" y2="${chartBottom}" />
        <line class="report-graph__tick" x1="${x}" x2="${x}" y1="${chartBottom}" y2="${chartBottom + 6}" />
        <text class="report-graph__tick-label" text-anchor="middle" x="${x}" y="${chartBottom + 24}">${formatTick(tick)}</text>
      </g>
    `
  }).join('')

  const yTickMarkup = yTicks.map((tick) => {
    const y = GRAPH_PLOT.top + GRAPH_PLOT.height - (tick / yMax) * GRAPH_PLOT.height

    return `
      <g>
        <line class="report-graph__grid report-graph__grid--horizontal" x1="${GRAPH_PLOT.left}" x2="${chartRight}" y1="${y}" y2="${y}" />
        <line class="report-graph__tick" x1="${GRAPH_PLOT.left - 6}" x2="${GRAPH_PLOT.left}" y1="${y}" y2="${y}" />
        <text class="report-graph__tick-label report-graph__tick-label--y" text-anchor="end" x="${GRAPH_PLOT.left - 12}" y="${y + 4}">${formatTick(tick)}</text>
      </g>
    `
  }).join('')

  const pointMarkup = chartPoints.map((point) => (
    `<circle class="report-graph__point" cx="${point.x}" cy="${point.y}" r="4.5" />`
  )).join('')

  return `
    <svg
      class="report-graph__svg"
      role="img"
      aria-label="${escapeHtml(ariaLabel)}"
      viewBox="0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          <![CDATA[
            .report-graph__plot-bg { fill: #fffdf8; stroke: rgba(112, 82, 55, 0.28); stroke-width: 1; }
            .report-graph__grid { stroke: rgba(117, 88, 62, 0.2); stroke-width: 0.8; }
            .report-graph__grid--horizontal { stroke-dasharray: 4 8; }
            .report-graph__axis { fill: none; stroke: #563927; stroke-linecap: round; stroke-width: 1.25; }
            .report-graph__tick { stroke: rgba(74, 43, 31, 0.38); stroke-linecap: round; stroke-width: 1; }
            .report-graph__tick-label { fill: #6a4b34; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 800; }
            .report-graph__tick-label--y { font-size: 11px; }
            .report-graph__axis-title { fill: #38271c; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 900; }
            .report-graph__line { fill: none; stroke: ${color}; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.6; }
            .report-graph__point { fill: #ffffff; stroke: ${color}; stroke-width: 2; }
          ]]>
        </style>
        <clipPath id="${clipId}">
          <rect height="${GRAPH_PLOT.height}" width="${GRAPH_PLOT.width}" x="${GRAPH_PLOT.left}" y="${GRAPH_PLOT.top}" />
        </clipPath>
      </defs>

      <rect class="report-graph__plot-bg" height="${GRAPH_PLOT.height}" width="${GRAPH_PLOT.width}" x="${GRAPH_PLOT.left}" y="${GRAPH_PLOT.top}" />
      ${xTickMarkup}
      ${yTickMarkup}

      <path class="report-graph__axis" d="M${GRAPH_PLOT.left} ${chartBottom}H${chartRight}" />
      <path class="report-graph__axis" d="M${GRAPH_PLOT.left} ${chartBottom}V${GRAPH_PLOT.top}" />

      <text class="report-graph__axis-title" text-anchor="middle" x="${GRAPH_PLOT.left + GRAPH_PLOT.width / 2}" y="${GRAPH_VIEWBOX.height - 10}">
        Torque (N·m)
      </text>
      <text
        class="report-graph__axis-title"
        text-anchor="middle"
        transform="rotate(-90 24 ${GRAPH_PLOT.top + GRAPH_PLOT.height / 2})"
        x="24"
        y="${GRAPH_PLOT.top + GRAPH_PLOT.height / 2}"
      >
        ${escapeHtml(yAxisLabel)}
      </text>

      <g clip-path="url(#${clipId})">
        <path class="report-graph__line" d="${linePath}" />
      </g>
      <g>
        ${pointMarkup}
      </g>
    </svg>
  `
}

const createObservationRows = observations => emptyObservationRows.map((_, index) => {
  const row = observations[index]
  return '<tr>' + OBSERVATION_COLUMNS.map(({ key }) => (
    '<td>' + formatObservationNumber(row?.[key], 2) + '</td>'
  )).join('') + '</tr>'
}).join('')

const getFullLoadObservation = observations => (
  [...observations].sort((a, b) => b.loadLevel - a.loadLevel)[0]
)

const createSummaryRows = observations => {
  const fullLoad = getFullLoadObservation(observations)
  return `
    <tr><th>Readings Recorded</th><td>${observations.length}</td></tr>
    <tr><th>Three-phase Line Voltage</th><td>${LINE_VOLTAGE} V</td></tr>
    <tr><th>Supply Frequency</th><td>${SUPPLY_FREQUENCY} Hz</td></tr>
    <tr><th>Brake Drum Radius</th><td>${BRAKE_DRUM_RADIUS} m</td></tr>
    <tr><th>Maximum Recorded Torque</th><td>${formatNumber(fullLoad?.torque, 2)} N·m</td></tr>
    <tr><th>Speed at Maximum Load</th><td>${formatNumber(fullLoad?.speed, 0)} RPM</td></tr>
    <tr><th>Total Input Power at Maximum Load</th><td>${formatNumber(fullLoad?.power, 2)} kW</td></tr>
  `
}

export const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  sessionStart,
  virtualLabsLogoSrc,
}) => {
  const reportDate = new Date()
  const sessionEnd = reportDate.getTime()
  const reportDateText = reportDate.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const startTimeText = new Date(sessionStart).toLocaleTimeString()
  const endTimeText = reportDate.toLocaleTimeString()
  const durationText = getSessionDurationText(sessionStart, sessionEnd)
  const fullLoadRow = getFullLoadObservation(observations)
  const observationRows = createObservationRows(observations)
  const summaryRows = createSummaryRows(observations)
  const speedGraphSvg = createReportGraphSvg({
    ariaLabel: 'Speed versus torque graph',
    color: '#0f766e',
    points: getGraphData(observations, 'speed'),
    title: 'Speed vs Torque',
    yAxisLabel: 'Speed (RPM)',
  })
  const powerGraphSvg = createReportGraphSvg({
    ariaLabel: 'Total input power versus torque graph',
    color: '#b45309',
    points: getGraphData(observations, 'power'),
    title: 'Total Input Power vs Torque',
    yAxisLabel: 'Total Input Power (kW)',
  })

  const css = `
body {
  margin: 0;
  padding: 18px 14px 30px;
  background: linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%);
  color: #1f2d3d;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.42;
  overflow-wrap: break-word;
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
.report-page {
  width: min(100%, 980px);
  margin: 0 auto 18px;
  padding: 22px 26px;
  overflow: visible;
  border: 1px solid #d3ddea;
  border-radius: 16px;
  background-color: #ffffff;
  box-shadow: 0 12px 28px rgba(23, 50, 77, 0.1);
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.report-page:last-of-type {
  margin-bottom: 0;
}
.report-page--graphs {
  break-before: page;
  page-break-before: always;
}
h1,
h2,
h3 {
  margin-top: 0;
  color: #1f2d3d;
  font-weight: 700;
}
h1 {
  margin: 0;
  font-size: 25px;
  line-height: 1.15;
}
h2 {
  margin-bottom: 12px;
  color: #243b53;
  font-size: 20px;
}
h3 {
  margin-bottom: 7px;
  color: #2d4b68;
  font-size: 15px;
}
p {
  margin: 0 0 8px;
}
li {
  margin-bottom: 4px;
}
ul,
ol {
  margin: 7px 0 0;
  padding-left: 20px;
}
.section {
  margin-bottom: 14px;
  padding: 16px 18px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f9fbfe 0%, #f4f7fb 100%);
}
.section:last-child {
  margin-bottom: 0;
}
.section > h2:first-child {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e1e9f3;
}
.header-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 108px;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.report-title-block {
  min-width: 0;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 3px solid #2f7bfa;
  text-align: center;
}
.report-subtitle {
  margin: 6px 0 0;
  color: #5c6f84;
  font-size: 13px;
}
.report-logo {
  width: auto;
  height: auto;
  object-fit: contain;
  flex-shrink: 0;
  justify-self: center;
}
.report-logo--virtual-labs {
  max-width: 190px;
  max-height: 86px;
  justify-self: start;
}
.report-logo--iit {
  max-width: 88px;
  max-height: 88px;
  justify-self: end;
}
.report-overview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.badge,
.report-stamp {
  margin: 0;
  padding: 7px 12px;
  border-radius: 20px;
  background: #e8f1ff;
  color: #1f62d0;
  font-size: 12px;
  font-weight: 700;
}
.report-stamp {
  background: #ffffff;
  color: #50657c;
  font-size: 13px;
}
.report-experiment-label {
  margin: 0 0 6px;
  color: #60778f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.report-experiment-title {
  margin: 0 0 14px;
  color: #16324b;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.info-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 9px;
  background: #fff;
  font-size: 13px;
}
.label {
  color: #1f2d3d;
  font-weight: 700;
}
.two-column-list {
  column-count: 2;
  column-gap: 32px;
  list-style-position: inside;
  margin-top: 10px;
}
.table-shell {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  border-radius: 12px;
  background: #ffffff;
}
table {
  width: 100%;
  margin-top: 0;
  border-collapse: collapse;
  background-color: white;
  table-layout: auto;
}
.report-observation-table {
  table-layout: fixed;
}
.report-observation-table__col-serial {
  width: 48px;
}
.report-observation-table__col-reading {
  width: 11%;
}
.report-observation-table__col-result {
  width: 13.5%;
}
.report-observation-table__serial-heading {
  min-width: 48px;
  vertical-align: middle;
  white-space: nowrap;
}
.report-observation-table__serial-heading > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: max-content;
  width: 100%;
}
th,
td {
  padding: 8px 9px;
  border: 1px solid #d9e2ec;
  font-size: 12.5px;
  text-align: center;
  vertical-align: middle;
  overflow-wrap: anywhere;
  word-break: break-word;
}
th {
  border-color: #c6d7ec;
  border-bottom-color: #b4cae5;
  color: white;
  background: linear-gradient(135deg, #2f7bfa 0%, #1f62d0 100%);
  font-weight: 700;
}
thead {
  display: table-header-group;
}
tbody {
  display: table-row-group;
}
tr {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
tr:nth-child(even) {
  background-color: #f8fbff;
}
.results-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.results-card {
  display: flex;
  width: 100%;
  max-width: 100%;
  flex-direction: column;
  gap: 9px;
  padding: 14px;
  overflow: visible;
  border-radius: 12px;
  background: #ffffff;
}
.results-card h3 {
  margin: 0;
  text-align: left;
}
.summary-table th {
  width: 35%;
}
.graphs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.report-graph-card {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.report-graph {
  display: flex;
  min-height: 0;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 0 0;
  overflow: visible;
  line-height: 0;
  border-radius: 12px;
  background: linear-gradient(180deg, #f8fbfe 0%, #eef5fb 100%);
}
.report-graph > * {
  max-width: 100%;
}
.report-graph em {
  color: #5e738c;
  font-style: normal;
  font-weight: 700;
}
.report-graph__image,
.report-graph__svg {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.report-graph__svg {
  font-family: Arial, Helvetica, sans-serif;
  shape-rendering: geometricPrecision;
  text-rendering: optimizeLegibility;
}
.report-graph__plot-bg {
  fill: #fffdf8;
  stroke: rgba(112, 82, 55, 0.28);
  stroke-width: 1;
}
.report-graph__grid {
  stroke: rgba(117, 88, 62, 0.2);
  stroke-width: 0.8;
}
.report-graph__grid--horizontal {
  stroke-dasharray: 4 8;
}
.report-graph__axis {
  fill: none;
  stroke: #563927;
  stroke-linecap: round;
  stroke-width: 1.25;
}
.report-graph__tick {
  stroke: rgba(74, 43, 31, 0.38);
  stroke-linecap: round;
  stroke-width: 1;
}
.report-graph__tick-label {
  fill: #6a4b34;
  font-size: 12px;
  font-weight: 800;
}
.report-graph__tick-label--y {
  font-size: 11px;
}
.report-graph__axis-title {
  fill: #38271c;
  font-size: 14px;
  font-weight: 900;
}
.report-graph__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
}
.report-graph__point {
  fill: #ffffff;
  stroke: var(--report-graph-color);
  stroke-width: 2;
}
.report-actions {
  display: flex;
  width: min(100%, 980px);
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px auto 0;
}
.print-btn,
.download-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 30px;
  color: white;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.25s ease;
}
.print-btn {
  background: linear-gradient(to right, #2f7bfa, #1f62d0);
}
.download-btn {
  background: linear-gradient(to right, #28a745, #1f8d38);
}
.print-btn:hover,
.download-btn:hover {
  box-shadow: 0 6px 14px rgba(31, 45, 61, 0.12);
  transform: translateY(-2px);
}
.pdf-exporting {
  width: 194mm !important;
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  color: #1f2d3d !important;
  font-size: 11px !important;
  line-height: 1.35 !important;
}
.pdf-exporting .print-btn,
.pdf-exporting .download-btn,
.pdf-exporting .report-actions {
  display: none !important;
}
.pdf-exporting .report-document {
  width: 194mm !important;
}
.pdf-exporting .report-page {
  width: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  break-before: auto !important;
  page-break-before: auto !important;
  break-inside: auto !important;
  page-break-inside: auto !important;
}
.pdf-exporting .report-page--overview {
  padding-bottom: 0 !important;
}
.pdf-exporting .report-page--graphs {
  break-before: page !important;
  page-break-before: always !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
.pdf-exporting .report-page--overview .section > br {
  display: none !important;
}
.pdf-exporting .header-row {
  grid-template-columns: 44mm minmax(0, 1fr) 26mm !important;
  gap: 6mm !important;
  margin-bottom: 5mm !important;
}
.pdf-exporting .report-title-block {
  padding-bottom: 7px !important;
}
.pdf-exporting .report-logo--virtual-labs {
  max-width: 42mm !important;
  max-height: 18mm !important;
}
.pdf-exporting .report-logo--iit {
  max-width: 21mm !important;
  max-height: 21mm !important;
}
.pdf-exporting h1 {
  font-size: 18px !important;
  line-height: 1.2 !important;
}
.pdf-exporting h2 {
  margin-bottom: 8px !important;
  padding-bottom: 6px !important;
  font-size: 15px !important;
  line-height: 1.25 !important;
}
.pdf-exporting h3 {
  margin-bottom: 5px !important;
  font-size: 12px !important;
  line-height: 1.25 !important;
}
.pdf-exporting p {
  margin-bottom: 6px !important;
}
.pdf-exporting ul,
.pdf-exporting ol {
  margin-top: 5px !important;
  padding-left: 18px !important;
}
.pdf-exporting li {
  margin-bottom: 3px !important;
}
.pdf-exporting .report-experiment-title {
  margin-bottom: 8px !important;
  font-size: 16px !important;
  line-height: 1.25 !important;
}
.pdf-exporting .section {
  margin-bottom: 3.5mm !important;
  padding: 3.5mm 4mm !important;
  border-radius: 3mm !important;
}
.pdf-exporting .report-page--overview .results-section,
.pdf-exporting .report-page--graphs .section {
  margin-bottom: 0 !important;
}
.pdf-exporting .report-overview-top {
  margin-bottom: 5px !important;
}
.pdf-exporting .badge,
.pdf-exporting .report-stamp {
  padding: 4px 8px !important;
  font-size: 10px !important;
}
.pdf-exporting .info-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 3mm !important;
  margin-top: 4mm !important;
}
.pdf-exporting .info-card {
  gap: 3px !important;
  padding: 7px 9px !important;
  font-size: 10px !important;
}
.pdf-exporting .two-column-list {
  column-count: 2 !important;
  column-gap: 10mm !important;
  margin-top: 5px !important;
}
.pdf-exporting .results-stack {
  gap: 3.5mm !important;
}
.pdf-exporting .results-card {
  gap: 2.5mm !important;
  padding: 3mm !important;
  border-radius: 3mm !important;
}
.pdf-exporting th,
.pdf-exporting td {
  padding: 4px 5px !important;
  font-size: 9.5px !important;
  line-height: 1.25 !important;
}
.pdf-exporting .report-observation-table {
  width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed !important;
}
.pdf-exporting .report-observation-table__col-serial {
  width: 13mm !important;
}
.pdf-exporting .report-observation-table__serial-heading {
  min-width: 13mm !important;
  padding-left: 2px !important;
  padding-right: 2px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}
.pdf-exporting .report-observation-table__serial-heading > span {
  min-width: calc(13mm - 4px) !important;
}
.pdf-exporting .report-observation-table th,
.pdf-exporting .report-observation-table td {
  padding: 3px 2px !important;
  font-size: 8.4px !important;
  line-height: 1.15 !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
}
.pdf-exporting .report-observation-table th {
  white-space: normal !important;
}
.pdf-exporting .report-observation-table th[rowspan],
.pdf-exporting .report-observation-table td {
  white-space: nowrap !important;
}
.pdf-exporting .table-shell {
  overflow: visible !important;
  border-radius: 3mm !important;
}
.pdf-exporting .graphs-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 3.5mm !important;
  margin-bottom: 4mm !important;
}
.pdf-exporting .report-graph {
  min-height: 0 !important;
  padding: 2mm !important;
  border-radius: 3mm !important;
}
.pdf-exporting .report-graph__svg,
.pdf-exporting .report-graph__image {
  max-height: 62mm !important;
  object-fit: contain !important;
}
.pdf-exporting .header-row,
.pdf-exporting .info-grid,
.pdf-exporting .report-graph-card,
.pdf-exporting .report-graph,
.pdf-exporting thead,
.pdf-exporting tr {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
@media (max-width: 768px) {
  body {
    padding: 20px 14px 30px;
  }
  .report-page {
    margin-bottom: 18px;
    padding: 20px 18px;
    border-radius: 16px;
  }
  .header-row {
    grid-template-columns: 1fr;
    gap: 14px;
    text-align: center;
  }
  .report-logo,
  .report-logo--virtual-labs,
  .report-logo--iit {
    max-height: 72px;
    justify-self: center;
  }
  .two-column-list {
    column-count: 1;
    column-gap: 0;
  }
  .graphs-grid {
    grid-template-columns: 1fr;
  }
  th,
  td {
    padding: 8px;
    font-size: 12px;
  }
  .report-actions {
    justify-content: center;
  }
}
@media print {
  @page {
    size: A4;
    margin: 8mm;
  }
  .print-btn,
  .download-btn,
  .report-actions {
    display: none;
  }
  html,
  body {
    width: auto;
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1f2d3d;
    font-size: 11px;
    line-height: 1.35;
  }
  .report-document {
    width: 100%;
  }
  .report-page {
    width: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: visible;
    border: none;
    border-radius: 0;
    box-shadow: none;
    break-before: auto;
    page-break-before: auto;
    break-inside: auto;
    page-break-inside: auto;
  }
  .report-page--overview {
    padding-bottom: 0;
  }
  .report-page--graphs {
    break-before: page;
    page-break-before: always;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .report-page--overview .section > br {
    display: none;
  }
  .header-row {
    grid-template-columns: 44mm minmax(0, 1fr) 26mm;
    gap: 6mm;
    margin-bottom: 5mm;
  }
  .report-title-block {
    padding-bottom: 7px;
  }
  .report-logo--virtual-labs {
    max-width: 42mm;
    max-height: 18mm;
  }
  .report-logo--iit {
    max-width: 21mm;
    max-height: 21mm;
  }
  h1 {
    font-size: 18px;
    line-height: 1.2;
  }
  h2 {
    margin-bottom: 8px;
    padding-bottom: 6px;
    font-size: 15px;
    line-height: 1.25;
  }
  h3 {
    margin-bottom: 5px;
    font-size: 12px;
    line-height: 1.25;
  }
  p {
    margin-bottom: 6px;
  }
  ul,
  ol {
    margin-top: 5px;
    padding-left: 18px;
  }
  li {
    margin-bottom: 3px;
  }
  .report-experiment-title {
    margin-bottom: 8px;
    font-size: 16px;
    line-height: 1.25;
  }
  .section {
    margin-bottom: 3.5mm;
    padding: 3.5mm 4mm;
    border-radius: 3mm;
  }
  .report-page--overview .results-section,
  .report-page--graphs .section {
    margin-bottom: 0;
  }
  .report-overview-top {
    margin-bottom: 5px;
  }
  .badge,
  .report-stamp {
    padding: 4px 8px;
    font-size: 10px;
  }
  .info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3mm;
    margin-top: 4mm;
  }
  .info-card {
    gap: 3px;
    padding: 7px 9px;
    font-size: 10px;
  }
  .two-column-list {
    column-count: 2;
    column-gap: 10mm;
    margin-top: 5px;
  }
  .results-stack {
    gap: 3.5mm;
  }
  .results-card {
    gap: 2.5mm;
    padding: 3mm;
    border-radius: 3mm;
  }
  th,
  td {
    padding: 4px 5px;
    font-size: 9.5px;
    line-height: 1.25;
  }
  .report-observation-table {
    width: 100%;
    min-width: 0;
    table-layout: fixed;
  }
  .report-observation-table__col-serial {
    width: 13mm;
  }
  .report-observation-table__serial-heading {
    min-width: 13mm;
    padding-left: 2px;
    padding-right: 2px;
    vertical-align: middle;
    white-space: nowrap;
  }
  .report-observation-table__serial-heading > span {
    min-width: calc(13mm - 4px);
  }
  .report-observation-table th,
  .report-observation-table td {
    padding: 3px 2px;
    font-size: 8.4px;
    line-height: 1.15;
    overflow-wrap: normal;
    word-break: normal;
  }
  .report-observation-table th {
    white-space: normal;
  }
  .report-observation-table th[rowspan],
  .report-observation-table td {
    white-space: nowrap;
  }
  .table-shell {
    overflow: visible;
    border-radius: 3mm;
  }
  .graphs-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3.5mm;
    margin-bottom: 4mm;
  }
  .report-graph {
    min-height: 0;
    padding: 2mm;
    border-radius: 3mm;
  }
  .report-graph__svg,
  .report-graph__image {
    max-height: 62mm;
    object-fit: contain;
  }
  .header-row,
  .info-grid,
  .report-graph-card,
  .report-graph,
  thead,
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
  `

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Three-Phase Motor Load Test Report</title>
  <base href="${escapeHtml(baseHref)}">
  <style>${css}</style>
</head>
<body id="report-root">
  <main class="report-document" id="report-document">
    <div class="report-page report-page--overview">
      <div class="header-row">
        <img src="${escapeHtml(virtualLabsLogoSrc)}" class="report-logo report-logo--virtual-labs" alt="Virtual Labs logo">
        <div class="report-title-block">
          <h1>Virtual Labs Simulation Report</h1>
        </div>
        <img src="${escapeHtml(iitLogoSrc)}" class="report-logo report-logo--iit" alt="Indian Institute of Technology Roorkee logo">
      </div>

      <div class="section report-overview">
        <div class="report-overview-top">
          <p class="badge">AI-Enhanced Basic Electrical Science Lab</p>
          <p class="report-stamp">Generated on ${escapeHtml(reportDateText)}</p>
        </div>
        <p class="report-experiment-label">Experiment Title</p>
        <p class="report-experiment-title">Load Test on a Three-Phase Motor</p>
        <div class="info-grid">
          <div class="info-card"><span class="label">Start Time:</span>${escapeHtml(startTimeText)}</div>
          <div class="info-card"><span class="label">End Time:</span>${escapeHtml(endTimeText)}</div>
          <div class="info-card"><span class="label">Total Time Spent:</span>${escapeHtml(durationText)}</div>
        </div>
      </div>

      <div class="section">
        <h2>Experiment Summary</h2>
        <h3>Aim</h3>
        <p style="text-align: justify;">The aim is to observe phase voltages, phase currents, total input power, spring balance readings, torque, and speed during a brake-load test on a three-phase motor.</p>
        <br>
        <h3>Simulation Summary</h3>
        <p style="text-align: justify;">The wiring and three current loops were verified. The MCB was switched on and the line voltage set to 400 V at 50 Hz. The no-load readings were recorded first. The pulley handle was turned to apply five increasing brake loads, recording the analyser, weight, torque, and speed readings at each stage.</p>
        <br>

        <h3>Apparatus Used</h3>
        <ul class="two-column-list">
          <li>Three-phase motor and brake drum</li>
          <li>400 V, 50 Hz three-phase supply and MCB</li>
          <li>Autotransformer</li>
          <li>Three-phase power analyser with three current loops</li>
          <li>Two spring balances (W1 and W2)</li>
          <li>Brake drum radius: 0.075 m</li>
          <li>Connecting leads</li>
        </ul>
        <p><strong>Torque:</strong> T = (W1 − W2) × 0.075 × 9.81 N·m.</p>
        <p>VR, VY, VB are phase voltages; IR, IY, IB are phase currents. P is total three-phase input power.</p>
        <br>
      </div>

      <div class="section results-section">
        <h2>Observations and Results</h2>
        <div class="results-stack">
          <div class="results-card results-card--table">
            <h3>Observation Table</h3>
            <div class="table-shell">
              <table class="report-observation-table">
                <thead><tr>${OBSERVATION_COLUMNS.map(({ label, unit }) => '<th>' + escapeHtml(label) + (unit ? '<br>(' + escapeHtml(unit) + ')' : '') + '</th>').join('')}</tr></thead>
                <tbody>${observationRows}</tbody>
              </table>
            </div>
          </div>

          <div class="results-card">
            <h3>Result Summary</h3>
            <div class="table-shell">
              <table class="summary-table">
                <tbody>${summaryRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="report-page report-page--graphs">
      <div class="section results-section">
        <h2>Graphs and Conclusion</h2>
        <div class="graphs-grid">
          <div class="results-card report-graph-card">
            <h3>Speed vs Torque</h3>
            <div class="report-graph">${speedGraphSvg}</div>
          </div>
          <div class="results-card report-graph-card">
            <h3>Total Input Power vs Torque</h3>
            <div class="report-graph">${powerGraphSvg}</div>
          </div>
        </div>
        <br>
        <div class="results-card">
          <h3>Conclusion</h3>
          <p style="text-align: justify;">The load test records the motor's electrical and mechanical readings as brake torque increases. At the maximum recorded load, W1 is ${formatNumber(fullLoadRow?.w1, 1)} kg and W2 is ${formatNumber(fullLoadRow?.w2, 1)} kg. The torque is ${formatNumber(fullLoadRow?.torque, 2)} N·m, speed is ${formatNumber(fullLoadRow?.speed, 0)} RPM, and total input power is ${formatNumber(fullLoadRow?.power, 2)} kW.</p>
        </div>
      </div>
    </div>
  </main>

  <div class="report-actions" data-html2canvas-ignore="true">
    <button class="print-btn" type="button" onclick="window.print()">PRINT</button>
    <button class="download-btn" type="button" onclick="downloadReport()">DOWNLOAD REPORT</button>
  </div>

  <script>
    function hasPdfTools() {
      return Boolean(window.html2canvas && window.jspdf && window.jspdf.jsPDF);
    }

    function loadPdfScript(src, isReady) {
      return new Promise(function(resolve, reject) {
        if (isReady()) return resolve();
        var existingScript = Array.from(document.scripts).find(function(script) {
          return script.src === src;
        });

        if (existingScript) {
          existingScript.addEventListener('load', function() {
            isReady() ? resolve() : reject();
          }, { once: true });
          existingScript.addEventListener('error', reject, { once: true });
          return;
        }

        var script = document.createElement('script');
        script.crossOrigin = 'anonymous';
        script.src = src;
        script.onload = function() {
          isReady() ? resolve() : reject();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    function ensurePdfTools() {
      return loadPdfScript(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        function() { return Boolean(window.html2canvas); },
      ).then(function() {
        return loadPdfScript(
          'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
          function() { return Boolean(window.jspdf && window.jspdf.jsPDF); },
        );
      }).then(function() {
        if (!hasPdfTools()) {
          throw new Error('PDF export tools did not load.');
        }
      });
    }

    function waitForPdfLayout() {
      var fontReady = document.fonts && document.fonts.ready
        ? document.fonts.ready.catch(function() {})
        : Promise.resolve();
      var imageReady = Array.from(document.images).map(function(image) {
        if (image.complete) {
          return image.decode ? image.decode().catch(function() {}) : Promise.resolve();
        }

        return new Promise(function(resolve) {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        });
      });

      return Promise.all([fontReady].concat(imageReady)).then(function() {
        return new Promise(function(resolve) {
          requestAnimationFrame(function() {
            requestAnimationFrame(resolve);
          });
        });
      });
    }

    function getReportPageCaptureSize(reportPage) {
      var fallbackWidth = Math.ceil(194 * 96 / 25.4);
      var pageRect = reportPage.getBoundingClientRect();
      var contentBounds = Array.from(reportPage.querySelectorAll('*')).reduce(function(bounds, element) {
        var elementRect = element.getBoundingClientRect();

        return {
          bottom: Math.max(bounds.bottom, elementRect.bottom - pageRect.top),
          right: Math.max(bounds.right, elementRect.right - pageRect.left),
        };
      }, {
        bottom: pageRect.height,
        right: pageRect.width,
      });
      var captureWidth = Math.max(
        fallbackWidth,
        contentBounds.right,
        reportPage.scrollWidth,
        reportPage.offsetWidth,
      );
      var captureHeight = Math.max(
        contentBounds.bottom,
        reportPage.scrollHeight,
        reportPage.offsetHeight,
      );

      return {
        height: Math.ceil(captureHeight),
        width: Math.ceil(captureWidth),
      };
    }

    function prepareReportGraphImages() {
      var graphContainers = Array.from(document.querySelectorAll('.report-graph'));

      return Promise.all(graphContainers.map(function(graphContainer) {
        return new Promise(function(resolve) {
          var svg = graphContainer.querySelector('svg');

          if (!svg) return resolve();

          try {
            var viewBox = svg.viewBox && svg.viewBox.baseVal;
            var width = viewBox && viewBox.width ? viewBox.width : 650;
            var height = viewBox && viewBox.height ? viewBox.height : 286;
            var svgText = new XMLSerializer().serializeToString(svg);
            var svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            var svgUrl = URL.createObjectURL(svgBlob);
            var image = new Image();

            image.onload = function() {
              var canvas = document.createElement('canvas');
              var scale = 2;
              canvas.width = width * scale;
              canvas.height = height * scale;

              var context = canvas.getContext('2d');
              context.fillStyle = '#f8fbfe';
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);

              var png = new Image();
              png.className = 'report-graph__image';
              png.alt = svg.getAttribute('aria-label') || 'Motor load-test result graph';
              png.src = canvas.toDataURL('image/png');
              graphContainer.innerHTML = '';
              graphContainer.appendChild(png);

              URL.revokeObjectURL(svgUrl);
              resolve();
            };

            image.onerror = function() {
              URL.revokeObjectURL(svgUrl);
              resolve();
            };

            image.src = svgUrl;
          } catch {
            resolve();
          }
        });
      }));
    }

    function downloadReport() {
      prepareReportGraphImages().then(ensurePdfTools).then(function() {
        var reportPages = Array.from(document.querySelectorAll('#report-document > .report-page'));
        var PdfConstructor = window.jspdf.jsPDF;
        var pdf = new PdfConstructor({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        var pageMargin = 8;
        var pageWidth = 210;
        var pageHeight = 297;
        var contentWidth = pageWidth - (pageMargin * 2);
        var contentHeight = pageHeight - (pageMargin * 2);

        if (!reportPages.length) {
          throw new Error('No report pages available to download.');
        }

        document.body.classList.add('pdf-exporting');

        return waitForPdfLayout().then(function() {
          return reportPages.reduce(function(pageChain, reportPage, pageIndex) {
            return pageChain.then(function() {
              if (pageIndex > 0) {
                pdf.addPage();
              }

              var captureSize = getReportPageCaptureSize(reportPage);

              return window.html2canvas(reportPage, {
                backgroundColor: '#ffffff',
                height: captureSize.height,
                scale: 2,
                scrollX: 0,
                scrollY: 0,
                useCORS: true,
                width: captureSize.width,
                windowWidth: captureSize.width,
              }).then(function(canvas) {
                var imageData = canvas.toDataURL('image/jpeg', 0.98);
                var renderWidth = contentWidth;
                var renderHeight = (canvas.height * renderWidth) / canvas.width;

                if (renderHeight > contentHeight) {
                  var fitRatio = contentHeight / renderHeight;
                  renderWidth *= fitRatio;
                  renderHeight = contentHeight;
                }

                pdf.addImage(
                  imageData,
                  'JPEG',
                  pageMargin + ((contentWidth - renderWidth) / 2),
                  pageMargin,
                  renderWidth,
                  renderHeight,
                  undefined,
                  'FAST',
                );
              });
            });
          }, Promise.resolve());
        }).then(function() {
          pdf.save('three-phase-motor-load-test-report.pdf');
          document.body.classList.remove('pdf-exporting');
        }, function(error) {
          document.body.classList.remove('pdf-exporting');
          throw error;
        });
      }).catch(function() {
        document.body.classList.remove('pdf-exporting');
        alert('Unable to download the report automatically. Please use your browser\\'s Save as PDF option.');
      });
    }
  </script>
</body>
</html>
  `
}

export const generateMotorReport = ({ observations, sessionStart }) => {
  const baseHref = new URL(import.meta.env.BASE_URL, window.location.origin).href
  const iitLogoSrc = new URL('../assets/IIT Logo.png', import.meta.url).href
  const virtualLabsLogoSrc = new URL('../assets/image.png', import.meta.url).href
  const reportHtml = createReportHtml({
    baseHref,
    iitLogoSrc,
    observations,
    sessionStart,
    virtualLabsLogoSrc,
  })
  const reportBlob = new Blob([reportHtml], { type: 'text/html' })
  const reportUrl = URL.createObjectURL(reportBlob)
  const reportWindow = window.open(reportUrl, '_blank')

  if (!reportWindow) {
    URL.revokeObjectURL(reportUrl)
    return false
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(reportUrl)
  }, 60000)
  reportWindow.focus()

  return true
}
