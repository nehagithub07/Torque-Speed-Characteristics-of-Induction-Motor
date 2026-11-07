import assert from 'node:assert/strict'
import test from 'node:test'
import { findWireDropTarget } from './wireDragging.js'

test('a release near a small scaled terminal snaps to its center', () => {
  const terminal = { id: 'motor', x: 120, y: 80, radius: 7 }
  assert.equal(findWireDropTarget({ x: 133, y: 80 }, [terminal], 'supply'), terminal)
})

test('dropping on empty space cancels without choosing a distant terminal', () => {
  assert.equal(findWireDropTarget({ x: 50, y: 50 }, [{ id: 'motor', x: 120, y: 80, radius: 14 }], 'supply'), null)
})

test('a drag cannot snap back to its source or to a disabled terminal', () => {
  const terminals = [
    { id: 'supply', x: 50, y: 50, radius: 14 },
    { id: 'locked', x: 55, y: 50, radius: 14, disabled: true },
  ]
  assert.equal(findWireDropTarget({ x: 52, y: 50 }, terminals, 'supply'), null)
})

test('closely spaced terminals select the nearest drop target', () => {
  const terminals = [
    { id: 'phase-r', x: 50, y: 50, radius: 14 },
    { id: 'phase-y', x: 80, y: 50, radius: 14 },
  ]
  assert.equal(findWireDropTarget({ x: 69, y: 50 }, terminals, 'supply').id, 'phase-y')
})
