// Screen-space distances keep the snap area usable at every simulator scale.
export const findWireDropTarget = (point, targets, sourceId) => {
  let nearest = null
  let nearestDistance = Infinity
  for (const target of targets) {
    if (target.id === sourceId || target.disabled) continue
    const distance = Math.hypot(point.x - target.x, point.y - target.y)
    if (distance <= target.radius + 8 && distance < nearestDistance) {
      nearest = target
      nearestDistance = distance
    }
  }
  return nearest
}
