import { TORQUE_SPEED_AXES, getTorqueSpeedPoints, getTorqueSpeedPosition, getTorqueSpeedPath } from './torqueSpeedGraph.js'
import { getReportPageScale } from './reportPagination.js'
import { createReportPdf, renderReportCanvas } from './reportPdf.js'
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
  const xTicks = TORQUE_SPEED_AXES.speedTicks
  const yTicks = TORQUE_SPEED_AXES.torqueTicks
  const chartPoints = points.map(point => getTorqueSpeedPosition(point, GRAPH_PLOT))
  const linePath = getTorqueSpeedPath(chartPoints)
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const clipId = `${chartId}-clip`

  const xTickMarkup = xTicks.map((tick) => {
    const { x } = getTorqueSpeedPosition({ speed: tick, torque: 0 }, GRAPH_PLOT)

    return `
      <g>
        <line class="report-graph__grid" x1="${x}" x2="${x}" y1="${GRAPH_PLOT.top}" y2="${chartBottom}" />
        <line class="report-graph__tick" x1="${x}" x2="${x}" y1="${chartBottom}" y2="${chartBottom + 6}" />
        <text class="report-graph__tick-label" text-anchor="middle" x="${x}" y="${chartBottom + 24}">${formatTick(tick)}</text>
      </g>
    `
  }).join('')

  const yTickMarkup = yTicks.map((tick) => {
    const { y } = getTorqueSpeedPosition({ speed: TORQUE_SPEED_AXES.speedMin, torque: tick }, GRAPH_PLOT)

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
        Speed (RPM)
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

const pdfScriptUrl = new URL('../../node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url).href

export const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  sessionStart,
  virtualLabsLogoSrc,
}) => {
  const reportDate = new Date()
  const sessionEnd = reportDate.getTime()
  const reportDateText = reportDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const startTimeText = new Date(sessionStart).toLocaleTimeString()
  const endTimeText = reportDate.toLocaleTimeString()
  const durationText = getSessionDurationText(sessionStart, sessionEnd)
  const fullLoadRow = getFullLoadObservation(observations)
  const observationRows = createObservationRows(observations)
  const torqueSpeedGraphSvg = createReportGraphSvg({
    ariaLabel: 'Torque (N-m) versus Speed (RPM); speed on the X-axis and torque on the Y-axis',
    color: '#0f766e',
    points: getTorqueSpeedPoints(observations),
    title: 'Torque vs Speed',
    yAxisLabel: 'Torque (N-m)',
  })
  const css = `
body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%);
  color: #1f2d3d;
  margin: 0;
  padding: 18px 14px 30px;
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
  width: min(100%, 960px);
  margin: 0 auto 18px;
  padding: 22px 26px;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #d3ddea;
  box-shadow: 0 12px 28px rgba(23, 50, 77, 0.1);
  break-inside: avoid-page;
  page-break-inside: avoid;
  overflow: visible;
  background-clip: padding-box;
}
.report-page:last-of-type {
  margin-bottom: 0;
}
h1,
h2,
h3 {
  color: #1f2d3d;
  margin-top: 0;
  font-weight: 700;
}
h1 {
  font-size: 28px;
  margin: 0;
  padding: 0;
  line-height: 1.15;
}
h2 {
  font-size: 20px;
  margin-bottom: 12px;
  color: #243b53;
}
h3 {
  font-size: 15px;
  margin-bottom: 7px;
  color: #2d4b68;
}
p {
  margin: 0 0 8px;
  text-align: justify;
  text-align-last: left;
}
li {
  margin-bottom: 4px;
  text-align: justify;
}
.section {
  background: linear-gradient(180deg, #f9fbfe 0%, #f4f7fb 100%);
  padding: 16px 18px;
  margin-bottom: 14px;
  border-radius: 12px;
  border: none;
  box-shadow: none;
  break-inside: auto;
  page-break-inside: auto;
  background-clip: padding-box;
}
.section:last-child {
  margin-bottom: 0;
}
.section > h2:first-child {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e1e9f3;
}
.label {
  font-weight: 600;
  color: #1f2d3d;
}
ul {
  padding-left: 20px;
  margin: 7px 0 0;
}
.two-column-list {
  column-count: 2;
  column-gap: 32px;
  list-style-position: inside;
  margin-top: 10px;
}
.report-overview-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.report-stamp {
  margin: 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: #ffffff;
  border: none;
  color: #50657c;
  font-size: 13px;
  font-weight: 600;
}
.report-experiment-label {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #60778f;
  font-weight: 700;
}
.report-experiment-title {
  margin: 0 0 14px;
  font-size: 22px;
  line-height: 1.3;
  font-weight: 700;
  color: #16324b;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.info-card {
  background: #fff;
  border: none;
  border-radius: 9px;
  padding: 10px 12px;
  box-shadow: none;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
}
.table-shell {
  display: block;
  width: 100%;
  align-self: stretch;
  overflow-x: auto;
  overflow-y: visible;
  border: none;
  border-radius: 12px;
  max-width: 100%;
  background: #ffffff;
  box-shadow: none;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  box-shadow: none;
  background-color: white;
  table-layout: auto;
}
th,
td {
  border: 1px solid #d9e2ec;
  padding: 9px 10px;
  text-align: center;
  font-size: 13px;
  vertical-align: middle;
  overflow-wrap: anywhere;
  word-break: break-word;
}
th {
  background: linear-gradient(135deg, #2f7bfa 0%, #1f62d0 100%);
  border-color: #c6d7ec;
  border-bottom-color: #b4cae5;
  color: white;
  font-weight: 700;
  letter-spacing: 0;
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
  background: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 14px;
  box-shadow: none;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: visible;
  background-clip: padding-box;
}
.results-card h3 {
  margin: 0;
  text-align: left;
  padding-bottom: 0;
  border-bottom: none;
}
.results-card--table {
  break-inside: auto;
  page-break-inside: auto;
}
.results-card--graph {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.compact-table {
  margin-top: 0;
}
.compact-table th,
.compact-table td {
  padding: 8px 10px;
  font-size: 13px;
}
.graph {
  text-align: center;
  margin-top: 0;
}
.report-graph-card {
  padding: 14px;
}
.report-graph-card #report-graph {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  position: relative;
  width: 100%;
  min-height: 340px;
  padding: 8px 0 0;
  background: linear-gradient(180deg, #f8fbfe 0%, #eef5fb 100%);
  border: none;
  border-radius: 12px;
  overflow: visible;
  background-clip: padding-box;
  box-shadow: none;
}
.report-graph-card #report-graph > * {
  max-width: 100%;
}
.report-graph-card #report-graph em {
  color: #5e738c;
  font-style: normal;
  font-weight: 600;
}
.report-graph__image {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.report-graph__svg {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
.report-graph__plot-bg {
  fill: #fffdf8;
  stroke: rgba(112, 82, 55, 0.28);
  stroke-width: 1;
}
.report-graph__band:nth-of-type(odd) {
  fill: rgba(51, 124, 102, 0.035);
}
.report-graph__band:nth-of-type(even) {
  fill: rgba(210, 78, 58, 0.025);
}
.report-graph__axis {
  fill: none;
  stroke: #563927;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.4;
}
.report-graph__svg marker path {
  fill: #563927;
}
.report-graph__grid {
  stroke: rgba(117, 88, 62, 0.2);
  stroke-width: 0.8;
}
.report-graph__grid--horizontal {
  stroke-dasharray: 4 8;
}
.report-graph__tick {
  stroke: rgba(74, 43, 31, 0.38);
  stroke-linecap: round;
  stroke-width: 1;
}
.report-graph__tick-label {
  fill: #6a4b34;
  font-size: 13px;
  font-weight: 700;
}
.report-graph__tick-label--y {
  font-size: 12px;
}
.report-graph__axis-title {
  fill: #38271c;
  font-size: 15px;
  font-weight: 800;
}
.report-graph__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}
.report-graph__point {
  fill: #ffffff;
  stroke-width: 1.6;
}
.report-graph__series-label {
  dominant-baseline: middle;
  font-size: 13px;
  font-weight: 800;
  paint-order: stroke;
  stroke: #fffdf8;
  stroke-linejoin: round;
  stroke-width: 5px;
}
.report-graph__series-label-sub {
  baseline-shift: sub;
  font-size: 72%;
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
  text-align: center;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 3px solid #2f7bfa;
  min-width: 0;
}
.report-title-block h1 {
  font-size: 25px;
}
.report-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #5c6f84;
}
.badge {
  margin: 0;
  padding: 7px 12px;
  border-radius: 20px;
  background: #e8f1ff;
  color: #1f62d0;
  font-weight: 600;
  font-size: 12px;
}
.report-logo {
  height: auto;
  width: auto;
  max-width: 108px;
  max-height: 84px;
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
.report-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  width: min(100%, 960px);
  margin: 20px auto 0;
}
.print-btn,
.download-btn {
  padding: 12px 24px;
  font-size: 15px;
  border: none;
  border-radius: 30px;
  color: white;
  cursor: pointer;
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
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(31, 45, 61, 0.12);
}
@media screen and (max-width: 768px) {
  body {
    padding: 20px 14px 30px;
  }
  #report-print-frame .report-page {
    margin-bottom: 18px;
    padding: 20px 18px;
    border-radius: 16px;
  }
  #report-print-frame .header-row {
    grid-template-columns: 1fr;
    gap: 14px;
    text-align: center;
  }
  #report-print-frame .report-title-block {
    padding-bottom: 12px;
  }
  #report-print-frame .report-logo,
  #report-print-frame .report-logo--virtual-labs,
  #report-print-frame .report-logo--iit {
    max-height: 72px;
    justify-self: center;
  }
  #report-print-frame .two-column-list {
    column-count: 1;
    column-gap: 0;
  }
  #report-print-frame .compact-table th,
  #report-print-frame .compact-table td {
    padding: 9px 8px;
    font-size: 13px;
  }
  .report-actions {
    justify-content: center;
  }
  #report-print-frame .report-graph-card #report-graph {
    min-height: 300px;
  }
}
/* Exports use a hidden copy so the visible report never changes size or position. */
.report-export-stage { position: fixed; left: -10000px; top: 0; width: 1000px; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.report-output .report-document { display: flow-root; width: 1000px; padding: 6px; font-size: 14px; line-height: 1.25; }
.report-output .report-page { width: 100%; margin: 0 0 8px; padding: 8px 12px; break-before: auto; break-after: auto; break-inside: auto; page-break-before: auto; page-break-after: auto; page-break-inside: auto; }
.report-output .report-page:last-child { margin-bottom: 0; }
.report-output .section { padding: 8px 10px; margin-bottom: 6px; }
.report-output .section:last-child { margin-bottom: 0; }
.report-output .section > h2:first-child { margin-bottom: 6px; padding-bottom: 5px; }
.report-output h2 { font-size: 18px; }
.report-output h3 { font-size: 14px; margin-bottom: 4px; }
.report-output p { margin-bottom: 5px; }
.report-output .header-row { grid-template-columns: 150px minmax(0, 1fr) 86px; gap: 12px; margin-bottom: 8px; }
.report-output .report-title-block { padding-bottom: 6px; }
.report-output .report-title-block h1 { font-size: 24px; }
.report-output .report-logo { max-height: 54px; }
.report-output .report-logo--virtual-labs { max-width: 150px; }
.report-output .report-logo--iit { max-width: 70px; }
.report-output .report-overview-top { margin-bottom: 6px; }
.report-output .badge, .report-output .report-stamp { padding: 5px 8px; font-size: 12px; }
.report-output .report-experiment-label { margin-bottom: 4px; font-size: 11px; }
.report-output .report-experiment-title { margin-bottom: 6px; font-size: 20px; }
.report-output .info-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; }
.report-output .info-card { padding: 6px 8px; gap: 2px; font-size: 12px; }
.report-output .two-column-list { margin-top: 6px; column-gap: 24px; }
.report-output li { margin-bottom: 2px; font-size: 13px; }
.report-output .results-stack { gap: 6px; }
.report-output .results-card { padding: 7px; gap: 4px; }
.report-output .compact-table th, .report-output .compact-table td { padding: 3px 6px; font-size: 12px; }
.report-output .report-graph-card #report-graph { height: 210px; min-height: 0; padding: 0; }
.report-output .report-graph__svg { width: 100%; height: 210px; }
.report-output .report-graph__tick-label, .report-output .report-graph__series-label { font-size: 18px; }
.report-output .report-graph__axis-title { font-size: 21px; }
@page { size: A4 portrait; margin: 8mm; }
@media print {
  *, *::before, *::after {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  html, body { width: 194mm; min-height: 0; margin: 0; padding: 0; background: #ffffff; }
  body > :not(#report-print-stage) { display: none !important; }
  #report-print-stage {
    display: block;
    position: relative;
    left: 0;
    visibility: visible;
    width: 194mm;
    height: var(--report-print-height);
    max-height: 281mm;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #report-print-stage .report-document {
    position: absolute;
    top: 0;
    left: calc((194mm - var(--report-print-width)) / 2);
    margin: 0;
    transform: scale(var(--report-print-scale, 1));
    transform-origin: top left;
  }
}

  `

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Induction Motor Simulation Report</title>
  <base href="${escapeHtml(baseHref)}">
  <style>${css}</style>
</head>
<body id="report-root">
  <div id="report-print-frame">
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
            <p class="badge">AI Enhanced Basic Electrical Science Lab</p>
            <p class="report-stamp">Generated on ${escapeHtml(reportDateText)}</p>
          </div>
          <p class="report-experiment-label">Experiment Title</p>
          <p class="report-experiment-title">Torque-Speed Characteristics of a Squirrel-Cage Induction Motor</p>
          <div class="info-grid">
            <div class="info-card"><span class="label">Start Time</span>${escapeHtml(startTimeText)}</div>
            <div class="info-card"><span class="label">End Time</span>${escapeHtml(endTimeText)}</div>
            <div class="info-card"><span class="label">Total Time Spent</span>${escapeHtml(durationText)}</div>
          </div>
        </div>

        <div class="section">
          <h2>Summary</h2>
          <h3>Aim</h3>
          <p>The aim of the experiment is to study the torque-speed characteristics of a three-phase squirrel-cage induction motor.</p>
          <h3>Simulation Summary</h3>
          <p>The wiring and three current loops were verified. The MCB was switched ON and the line voltage set to ${LINE_VOLTAGE} V at ${SUPPLY_FREQUENCY} Hz. The no-load readings were recorded first. The pulley handle was turned to apply five increasing brake loads. A total of ${observations.length} readings of phase voltages, phase currents, total input power, spring balance weights, torque, and speed were recorded and used to plot the torque-speed graph.</p>
          <h3>Components and Key Parameters</h3>
          <ul class="two-column-list">
            <li>Three-phase squirrel-cage induction motor, 415 V, 2.2 kW, 4.8 A max., 1400 RPM</li>
            <li>MCB, 3P, 415 V AC, 16 A, 50 Hz</li>
            <li>Three-phase autotransformer, 12.21 kVA, 15 A, 0-450 V AC output</li>
            <li>Three-phase power analyzer with three current loops</li>
            <li>Tachometer, 2000 RPM</li>
            <li>Brake drum and two spring balances (W1 and W2), drum radius ${BRAKE_DRUM_RADIUS} m</li>
            <li>Connecting leads</li>
          </ul>
        </div>
      </div>

      <div class="report-page report-page--results">
        <div class="section results-section">
          <h2>Results</h2>
          <div class="results-stack">
            <div class="results-card results-card--table">
              <h3>Observation Table</h3>
              <div class="table-shell">
                <table class="compact-table report-observation-table" aria-label="Motor load test observations">
                  <thead><tr>${OBSERVATION_COLUMNS.map(({ label, subscript, unit }) => '<th>' + escapeHtml(label) + (subscript ? '<sub>' + escapeHtml(subscript) + '</sub>' : '') + (unit ? '<br>(' + escapeHtml(unit) + ')' : '') + '</th>').join('')}</tr></thead>
                  <tbody>${observationRows}</tbody>
                </table>
              </div>
              <p>V<sub>R</sub>, V<sub>Y</sub>, V<sub>B</sub> are phase voltages. I<sub>R</sub>, I<sub>Y</sub>, I<sub>B</sub> are phase currents. P is total three-phase input power.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="report-page report-page--graph">
        <div class="section results-section">
          <h2>Graph and Torque Calculation</h2>
          <div class="results-stack">
            <div class="graph report-graph-card results-card results-card--graph">
              <h3 style="text-align: center;">Torque vs Speed</h3>
              <div id="report-graph">${torqueSpeedGraphSvg}</div>
            </div>
            <div class="results-card">
              <h3>Torque Calculation</h3>
              <p>T = (W1 − W2) × ${BRAKE_DRUM_RADIUS} × 9.81 N·m.</p>
              <p>W1 and W2 are spring balance readings in kilograms. Torque is calculated using their difference, the brake drum radius, and gravitational acceleration.</p>
            </div>
            <div class="results-card">
              <h3>Conclusion</h3>
              <p>The load test records the motor's electrical and mechanical readings as brake torque increases. At the maximum recorded load, W1 is ${formatNumber(fullLoadRow?.w1, 1)} kg and W2 is ${formatNumber(fullLoadRow?.w2, 1)} kg. The torque is ${formatNumber(fullLoadRow?.torque, 2)} N·m, speed is ${formatNumber(fullLoadRow?.speed, 0)} RPM, and total input power is ${formatNumber(fullLoadRow?.power, 2)} kW.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div class="report-actions">
    <button class="print-btn" type="button" onclick="printReport()">PRINT</button>
    <button class="download-btn" type="button" onclick="downloadReport()">DOWNLOAD REPORT</button>
  </div>
  <audio id="report-print-audio" src="simulation-audios/Print.wav" preload="auto"></audio>
  <script>
    var getReportPageScale = ${getReportPageScale.toString()};
    var createReportPdf = ${createReportPdf.toString()};
    var renderReportCanvas = ${renderReportCanvas.toString()};
    var reportAssets = ${JSON.stringify({
      script: new URL(pdfScriptUrl, baseHref).href,
    }).replaceAll('<', '\\u003c')};
    var pdfAssetsPromise;
    var downloadInProgress = false;
    var reportExportCount = 0;

    function waitForReportAssets() {
      var stage = document.getElementById('report-print-stage');
      if (!stage) {
        stage = createReportOutput();
        stage.id = 'report-print-stage';
      }
      var images = Array.from(document.querySelectorAll('#report-document img, #report-print-stage img'));
      return Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...images.map(function(image) {
          if (image.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          });
        })
      ]);
    }

    function createReportOutput() {
      var stage = document.createElement('div');
      stage.className = 'report-export-stage report-output';
      stage.setAttribute('aria-hidden', 'true');
      var report = document.getElementById('report-document').cloneNode(true);
      report.removeAttribute('id');
      // Keep the copy's graph markers and clipping paths independent of the preview.
      var suffix = '-export-' + (++reportExportCount);
      report.querySelectorAll('svg [id]').forEach(function(definition) {
        var originalId = definition.id;
        definition.id = originalId + suffix;
        report.querySelectorAll('svg [marker-end], svg [clip-path]').forEach(function(element) {
          ['marker-end', 'clip-path'].forEach(function(attribute) {
            var value = element.getAttribute(attribute);
            if (value) element.setAttribute(attribute, value.replaceAll('url(#' + originalId + ')', 'url(#' + definition.id + ')'));
          });
        });
      });
      stage.appendChild(report);
      document.body.appendChild(stage);
      return stage;
    }

    function fitReportForPrint() {
      var stage = document.getElementById('report-print-stage') || createReportOutput();
      stage.id = 'report-print-stage';
      var report = stage.querySelector('.report-document');
      // The report's base URL points to app assets; printed SVG references must
      // point to this report document instead of that base URL.
      report.querySelectorAll('svg [marker-end], svg [clip-path]').forEach(function(element) {
        ['marker-end', 'clip-path'].forEach(function(attribute) {
          var value = element.getAttribute(attribute);
          if (value) element.setAttribute(attribute, value.replace('url(#', 'url(' + document.URL.split('#')[0] + '#'));
        });
      });
      // Measure the full, unscaled document, including repeated beforeprint events.
      report.style.transform = 'none';
      var width = Math.max(report.scrollWidth, report.getBoundingClientRect().width);
      var height = Math.max(report.scrollHeight, report.getBoundingClientRect().height);
      // A4 with 8 mm margins; reserve two pixels for browser rounding.
      var scale = getReportPageScale(width, height, 194 * 96 / 25.4 - 2, 281 * 96 / 25.4 - 2);
      document.documentElement.style.setProperty('--report-print-scale', scale);
      document.documentElement.style.setProperty('--report-print-width', (width * scale) + 'px');
      document.documentElement.style.setProperty('--report-print-height', (height * scale) + 'px');
      report.style.removeProperty('transform');
    }

    function restoreReportLayout() {
      document.documentElement.style.removeProperty('--report-print-scale');
      document.documentElement.style.removeProperty('--report-print-width');
      document.documentElement.style.removeProperty('--report-print-height');
    }

    function playPrintNarration() {
      var audio = document.getElementById('report-print-audio');
      return new Promise(function(resolve) {
        audio.currentTime = 0;
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
    }

    var printInProgress = false;
    async function printReport() {
      if (printInProgress || downloadInProgress) return;
      printInProgress = true;
      try {
        await Promise.all([waitForReportAssets(), playPrintNarration()]);
        fitReportForPrint();
        window.print();
      } finally {
        restoreReportLayout();
        printInProgress = false;
      }
    }

    window.addEventListener('beforeprint', fitReportForPrint);
    window.addEventListener('afterprint', restoreReportLayout);
    // Load the hidden print copy's logos before the browser takes a print snapshot.
    waitForReportAssets();

    function loadPdfAssets() {
      if (pdfAssetsPromise) return pdfAssetsPromise;
      pdfAssetsPromise = (window.jspdf ? Promise.resolve() : new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = reportAssets.script;
        script.onload = resolve;
        script.onerror = function() { script.remove(); reject(new Error('Unable to load the PDF renderer.')); };
        document.head.appendChild(script);
      })).catch(function(error) {
        pdfAssetsPromise = null;
        throw error;
      });
      return pdfAssetsPromise;
    }

    async function downloadReport() {
      if (downloadInProgress || printInProgress) return;
      downloadInProgress = true;
      var buttons = Array.from(document.querySelectorAll('.report-actions button'));
      buttons.forEach(function(button) { button.disabled = true; });
      var stage;
      try {
        await loadPdfAssets();
        await waitForReportAssets();
        stage = createReportOutput();
        var capture = await renderReportCanvas(stage.querySelector('.report-document'));
        var pdf = createReportPdf(window.jspdf.jsPDF, capture);
        if (pdf.internal.getNumberOfPages() !== 1) throw new Error('Report did not fit on one page.');
        pdf.save('Induction Motor Simulation Report.pdf');
      } catch {
        alert("Unable to download the report automatically. Please use PRINT and select Save as PDF.");
      } finally {
        if (stage) stage.remove();
        downloadInProgress = false;
        buttons.forEach(function(button) { button.disabled = false; });
      }
    }

  </script>
</body>
</html>
  `
}

export const prepareMotorReport = ({ observations, sessionStart }) => {
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
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    URL.revokeObjectURL(reportUrl)
  }

  return {
    dispose,
    open: () => {
      if (disposed) return false
      const reportWindow = window.open(reportUrl, '_blank')
      if (!reportWindow) return false
      window.setTimeout(dispose, 60000)
      reportWindow.focus()
      return true
    },
  }
}

export const generateMotorReport = (options) => {
  const report = prepareMotorReport(options)
  const opened = report.open()
  if (!opened) report.dispose()
  return opened
}
