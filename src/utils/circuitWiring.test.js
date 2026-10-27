import assert from 'node:assert/strict'
import test from 'node:test'
import { CURRENT_PROBES, REQUIRED_TERMINAL_CONNECTIONS, TERMINALS_BY_NUMBER } from '../config/circuitConnections.js'
import {
  createDefaultConnections, getConnectedCurrentProbes, removeConnectionsFromTerminal, validateConnections,
} from './circuitWiring.js'

const connection = (source, target) => ({
  sourceId: TERMINALS_BY_NUMBER[source].id,
  targetId: TERMINALS_BY_NUMBER[target].id,
})

const motorWiring = () => REQUIRED_TERMINAL_CONNECTIONS.map(([sourceId, targetId]) => ({ sourceId, targetId }))
const probeConnection = (phase, targetPhase = phase) => ({
  sourceId: CURRENT_PROBES[phase].terminalId,
  targetId: CURRENT_PROBES[targetPhase].targetId,
})

test('auto connect completes nine terminal pairs and three separate current loops', () => {
  const result = validateConnections(createDefaultConnections())
  assert.equal(result.isCorrect, true)
  assert.equal(result.matchedCount, 12)
  assert.equal(result.totalConnections, 12)
  assert.equal(getConnectedCurrentProbes(createDefaultConnections()).length, 3)
})

test('accepts every required wire when drawn in the opposite direction', () => {
  const reversed = createDefaultConnections().map(({ sourceId, targetId }) => ({ sourceId: targetId, targetId: sourceId }))
  assert.equal(validateConnections(reversed).isCorrect, true)
})

test('reports the remaining wires and three current loops after 1–4 is connected', () => {
  const result = validateConnections([connection(1, 4)])
  assert.equal(result.isCorrect, false)
  assert.deepEqual(result.missingConnections.map(item => item.label), ['2-5', '3-6', '7-10', '8-11', '9-12', '7-16', '8-17', '9-18', '13 → loop on 7-16', '14 → loop on 8-17', '15 → loop on 9-18'])
})

test('detects an incorrect pair while keeping the missing-pair count accurate', () => {
  const result = validateConnections([connection(1, 5)])
  assert.equal(result.missingConnections.length, 12)
  assert.deepEqual(result.wrongConnections.map(item => item.label), ['1-5'])
})

test('detects reversed duplicate wires even if all required pairs exist', () => {
  const result = validateConnections([...createDefaultConnections(), connection(4, 1)])
  assert.equal(result.isCorrect, false)
  assert.equal(result.matchedCount, 12)
  assert.equal(result.wrongConnections[0].duplicate, true)
})

test('rejects a terminal-to-terminal wire instead of a current loop', () => {
  const result = validateConnections([...createDefaultConnections(), connection(7, 13)])
  assert.equal(result.isCorrect, false)
  assert.equal(result.wrongConnections[0].label, '7-13')
})

test('accepts the two required branches from each autotransformer output', () => {
  const result = validateConnections([connection(7, 10), connection(7, 16)])
  assert.equal(result.matchedCount, 2)
  assert.deepEqual(result.wrongConnections, [])
})

test('connecting motor wires does not automatically add current loops', () => {
  const wires = motorWiring()
  assert.deepEqual(getConnectedCurrentProbes(wires), [])
  const result = validateConnections(wires)
  assert.equal(result.isCorrect, false)
  assert.equal(result.matchedCount, 9)
  assert.equal(result.missingConnections.length, 3)
})

test('each manual loop is required independently', () => {
  const connections = motorWiring()
  for (let phase = 0; phase < 3; phase += 1) {
    connections.push(probeConnection(phase))
    const result = validateConnections(connections)
    assert.equal(getConnectedCurrentProbes(connections).length, phase + 1)
    assert.equal(result.missingConnections.length, 2 - phase)
    assert.equal(result.isCorrect, phase === 2)
  }
})

test('a loop on the wrong phase does not complete the required loop', () => {
  const result = validateConnections([...motorWiring(), probeConnection(0, 1)])
  assert.equal(result.matchedCount, 9)
  assert.equal(result.wrongConnections[0].label, '13 → loop on 8-17')
  assert.equal(result.missingConnections.length, 3)
})

test('a loop needs its motor wire to exist', () => {
  const connections = [probeConnection(0)]
  assert.deepEqual(getConnectedCurrentProbes(connections), [])
  const result = validateConnections(connections)
  assert.equal(result.matchedCount, 0)
  assert.equal(result.wrongConnections.length, 1)
})

test('removing probe 13 preserves the motor wire and the other loops', () => {
  const remaining = removeConnectionsFromTerminal(createDefaultConnections(), CURRENT_PROBES[0].terminalId)
  assert.equal(remaining.length, 11)
  assert.equal(getConnectedCurrentProbes(remaining).length, 2)
  assert.deepEqual(validateConnections(remaining).missingConnections.map(item => item.label), ['13 → loop on 7-16'])
})

test('removing a motor wire removes its attached loop without affecting other phases', () => {
  const remaining = removeConnectionsFromTerminal(createDefaultConnections(), TERMINALS_BY_NUMBER[16].id)
  assert.equal(remaining.length, 10)
  assert.equal(getConnectedCurrentProbes(remaining).length, 2)
  assert.deepEqual(validateConnections(remaining).missingConnections.map(item => item.label), ['7-16', '13 → loop on 7-16'])
})

test('reversed duplicate loops are rejected', () => {
  const { sourceId, targetId } = probeConnection(0)
  const result = validateConnections([...createDefaultConnections(), { sourceId: targetId, targetId: sourceId }])
  assert.equal(result.isCorrect, false)
  assert.equal(result.matchedCount, 12)
  assert.equal(result.wrongConnections[0].duplicate, true)
})
