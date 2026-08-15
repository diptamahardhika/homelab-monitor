import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshIntervalForVisibility } from './refresh.mjs'

test('uses a longer refresh interval while the dashboard is hidden', () => {
  assert.equal(refreshIntervalForVisibility('visible'), 10_000)
  assert.equal(refreshIntervalForVisibility('hidden'), 60_000)
})
