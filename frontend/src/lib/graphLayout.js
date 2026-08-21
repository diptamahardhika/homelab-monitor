export const NODE_W = 150
export const NODE_H = 40
export const GAP_X = 100
export const GAP_Y = 28
export const PAD = 24

// Layered topological layout of a DAG. Backend prevents cycles at add-time,
// but guards against a malformed file for safety.
export function layoutGraph(deps) {
  const edges = []
  const nodes = new Set()
  const adj = new Map()
  const indeg = new Map()

  for (const d of deps) {
    const from = d && d.from
    const to = d && d.to
    if (!from || !to || from === to) continue
    edges.push({ from, to })
    nodes.add(from)
    nodes.add(to)
    if (!adj.has(from)) adj.set(from, [])
    adj.get(from).push(to)
    indeg.set(to, (indeg.get(to) || 0) + 1)
    if (!indeg.has(from)) indeg.set(from, 0)
  }

  const layer = new Map()
  for (const n of nodes) layer.set(n, 0)

  // Kahn's algorithm → longest-path layering
  const queue = [...nodes].filter(n => (indeg.get(n) || 0) === 0).map(n => ({ n, d: 0 }))
  const seen = new Set()
  let guard = 0
  while (queue.length && guard < 10000) {
    guard++
    const { n, d } = queue.shift()
    if (seen.has(n)) continue
    seen.add(n)
    layer.set(n, Math.max(layer.get(n), d))
    for (const child of adj.get(n) || []) {
      layer.set(child, Math.max(layer.get(child), d + 1))
      queue.push({ n: child, d: d + 1 })
    }
  }
  // Any node never reached (cycle) sits at layer 0 rather than looping forever.
  for (const n of nodes) if (!seen.has(n)) layer.set(n, 0)

  const byLayer = new Map()
  for (const n of nodes) {
    const l = layer.get(n) || 0
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(n)
  }

  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  const pos = new Map()
  const W = Math.max(PAD * 2, PAD * 2 + layers.length * (NODE_W + GAP_X) - GAP_X)
  const maxColH = layers.reduce((m, l) => Math.max(m, byLayer.get(l).length * (NODE_H + GAP_Y) - GAP_Y), 0)
  const H = PAD * 2 + maxColH

  layers.forEach((l, li) => {
    const arr = byLayer.get(l)
    const colH = arr.length * (NODE_H + GAP_Y) - GAP_Y
    let y = PAD + (H - 2 * PAD - colH) / 2
    const x = PAD + li * (NODE_W + GAP_X)
    for (const n of arr) {
      pos.set(n, { x, y })
      y += NODE_H + GAP_Y
    }
  })

  return { edges, nodes: [...nodes], pos, W, H }
}

export function nodeMeta(name, servers, services, containers) {
  const svc = services.find(s => s.name === name)
  if (svc) {
    return { kind: 'service', color: svc.status === 'up' ? '#10b981' : svc.status === 'down' ? '#ef4444' : '#f59e0b', item: svc }
  }
  const srv = servers.find(s => s.name === name)
  if (srv) {
    return { kind: 'server', color: srv.alive ? '#10b981' : '#ef4444', item: srv }
  }
  const ctn = containers.find(c => c.name === name)
  if (ctn) {
    return { kind: 'container', color: ctn.state === 'running' ? '#10b981' : ctn.state === 'paused' ? '#f59e0b' : '#6b7280', item: ctn }
  }
  return { kind: 'unknown', color: '#6b7280', item: null }
}
