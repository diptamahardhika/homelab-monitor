import { describe, it, expect } from 'vitest'
import { NODE_W, NODE_H, GAP_X, GAP_Y, PAD, layoutGraph, nodeMeta } from './graphLayout'

describe('layoutGraph', () => {
  it('returns empty layout for no dependencies', () => {
    const g = layoutGraph([])
    expect(g.edges).toEqual([])
    expect(g.nodes).toEqual([])
    expect(g.W).toBe(PAD * 2)
    expect(g.H).toBe(PAD * 2)
    expect(g.pos.size).toBe(0)
  })

  it('skips malformed and self-loop edges', () => {
    const g = layoutGraph([
      { from: 'a', to: 'a' },
      { from: '', to: 'b' },
      { from: 'c', to: '' },
      null,
    ])
    expect(g.edges).toEqual([])
    expect(g.nodes).toEqual([])
  })

  it('layers a linear chain by longest path', () => {
    const g = layoutGraph([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ])
    expect(g.nodes.sort()).toEqual(['a', 'b', 'c'])
    expect(g.pos.get('a').x).toBe(PAD)
    expect(g.pos.get('b').x).toBe(PAD + NODE_W + GAP_X)
    expect(g.pos.get('c').x).toBe(PAD + 2 * (NODE_W + GAP_X))
    // same-layer nodes share y; deeper layers start at the same top y for a chain
    expect(g.pos.get('a').y).toBe(g.pos.get('b').y)
  })

  it('uses longest-path layering for diamonds', () => {
    const g = layoutGraph([
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ])
    const ax = g.pos.get('a').x
    const dx = g.pos.get('d').x
    // d is 2 hops from a, so it must sit two columns right
    expect(dx - ax).toBe(2 * (NODE_W + GAP_X))
    expect(g.W).toBe(PAD * 2 + 3 * (NODE_W + GAP_X) - GAP_X)
  })

  it('places cycle members at layer 0 instead of looping forever', () => {
    const g = layoutGraph([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ])
    expect(g.nodes.sort()).toEqual(['a', 'b'])
    // both stuck at layer 0 → single column of width NODE_W
    expect(g.pos.get('a').x).toBe(g.pos.get('b').x)
    expect(g.W).toBe(PAD * 2 + NODE_W)
  })

  it('stacks same-layer nodes vertically with node height + gap', () => {
    const g = layoutGraph([
      { from: 'a', to: 'c' },
      { from: 'b', to: 'c' },
    ])
    const a = g.pos.get('a')
    const b = g.pos.get('b')
    expect(a.x).toBe(b.x)
    expect(b.y - a.y).toBe(NODE_H + GAP_Y)
  })
})

describe('nodeMeta', () => {
  const servers = [{ name: 'srv', alive: true }, { name: 'dead-srv', alive: false }]
  const services = [{ name: 'svc', status: 'up' }, { name: 'down-svc', status: 'down' }, { name: 'deg-svc', status: 'degraded' }]
  const containers = [{ name: 'ctn', state: 'running' }, { name: 'paused-ctn', state: 'paused' }, { name: 'dead-ctn', state: 'exited' }]

  it('prefers services over servers/containers', () => {
    const meta = nodeMeta('svc', [{ name: 'svc' }], services, [{ name: 'svc' }])
    expect(meta.kind).toBe('service')
    expect(meta.color).toBe('#10b981')
  })

  it('colors services by status', () => {
    expect(nodeMeta('down-svc', [], services, []).color).toBe('#ef4444')
    expect(nodeMeta('deg-svc', [], services, []).color).toBe('#f59e0b')
  })

  it('colors servers by alive', () => {
    expect(nodeMeta('srv', servers, [], []).kind).toBe('server')
    expect(nodeMeta('srv', servers, [], []).color).toBe('#10b981')
    expect(nodeMeta('dead-srv', servers, [], []).color).toBe('#ef4444')
  })

  it('colors containers by state', () => {
    expect(nodeMeta('ctn', [], [], containers).color).toBe('#10b981')
    expect(nodeMeta('paused-ctn', [], [], containers).color).toBe('#f59e0b')
    expect(nodeMeta('dead-ctn', [], [], containers).color).toBe('#6b7280')
  })

  it('returns unknown for unmatched names', () => {
    const meta = nodeMeta('nope', [], [], [])
    expect(meta.kind).toBe('unknown')
    expect(meta.item).toBeNull()
  })
})
