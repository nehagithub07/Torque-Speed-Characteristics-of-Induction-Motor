export const TORQUE_SPEED_AXES = {
  speedMin: 1400,
  speedMax: 1500,
  torqueMax: 12,
  speedTicks: [1400, 1420, 1440, 1460, 1480, 1500],
  torqueTicks: [0, 2, 4, 6, 8, 10, 12],
}

export const getTorqueSpeedPoints = observations => observations
  .map(({ speed, torque }) => ({ speed: Number(speed), torque: Number(torque) }))
  .filter(({ speed, torque }) => Number.isFinite(speed) && Number.isFinite(torque))
  .sort((a, b) => a.speed - b.speed)

export const getTorqueSpeedPosition = (point, plot) => ({
  ...point,
  x: plot.left + ((point.speed - TORQUE_SPEED_AXES.speedMin) / (TORQUE_SPEED_AXES.speedMax - TORQUE_SPEED_AXES.speedMin)) * plot.width,
  y: plot.top + plot.height - (point.torque / TORQUE_SPEED_AXES.torqueMax) * plot.height,
})

export const getTorqueSpeedPath = points => points
  .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
  .join(' ')
