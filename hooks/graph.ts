import type { Cell, Commit, GraphRow, Ref, Segment } from '../types'

// vscode-git-graph 預設色盤，依 lane index 輪替
export const LANE_COLORS = ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8']
export const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length]!

// %D 一段 → Ref[]；本地分支與同名 remote 分支併成一個 pill
export function parseRefs(decoration: string, remotes: string[]): Ref[] {
  const branches: Extract<Ref, { kind: 'branch' }>[] = []
  const remoteRefs: string[] = []
  const tags: Ref[] = []
  let detached = false
  for (const raw of decoration.split(', ').filter(Boolean)) {
    if (raw === 'HEAD') detached = true
    else if (raw.startsWith('HEAD -> ')) branches.push({ kind: 'branch', name: raw.slice(8), remotes: [], isHead: true })
    else if (raw.startsWith('tag: ')) tags.push({ kind: 'tag', name: raw.slice(5) })
    else if (remotes.some(r => raw.startsWith(`${r}/`))) {
      if (!raw.endsWith('/HEAD')) remoteRefs.push(raw)
    } else branches.push({ kind: 'branch', name: raw, remotes: [], isHead: false })
  }
  const lone: Ref[] = []
  for (const full of remoteRefs) {
    const slash = full.indexOf('/')
    const local = branches.find(b => b.name === full.slice(slash + 1))
    if (local) local.remotes.push(full.slice(0, slash))
    else lone.push({ kind: 'remote', name: full })
  }
  return [...(detached ? [{ kind: 'detached' } as const] : []), ...branches, ...lone, ...tags]
}

// git log --format=%H%x1f%P%x1f%D%x1f%an%x1f%at%x1f%s
export function parseLog(stdout: string, remotes: string[]): Commit[] {
  return stdout.split('\n').filter(Boolean).map(line => {
    const [hash = '', parents = '', deco = '', author = '', time = '0', ...rest] = line.split('\x1f')
    return { hash, parents: parents.split(' ').filter(Boolean), refs: parseRefs(deco, remotes), author, time: Number(time), subject: rest.join('\x1f') }
  })
}

const H_CROSS: Record<string, string> = { '│': '┼', ' ': '─' }

// active-lanes 排版：每條 lane 佔 2 欄（偶數格放 lane，奇數格放橫線）
export function layout(commits: Commit[]): GraphRow[] {
  const lanes: (string | null)[] = []
  return commits.map(c => {
    const above = [...lanes]
    let col = lanes.indexOf(c.hash)
    if (col < 0) {
      col = lanes.indexOf(null)
      if (col < 0) col = lanes.length
      lanes[col] = c.hash
    }
    const cells: Cell[] = []
    const put = (x: number, ch: string, lane: number) => {
      while (cells.length <= x) cells.push({ ch: ' ', lane: -1 })
      cells[x] = { ch, lane }
    }
    const hline = (from: number, to: number, lane: number) => {
      for (let x = Math.min(from, to) + 1; x < Math.max(from, to); x++) {
        const cur = cells[x]?.ch ?? ' '
        put(x, H_CROSS[cur] ?? cur, cur === '│' ? (cells[x]?.lane ?? lane) : lane)
      }
    }
    lanes.forEach((h, i) => { if (h && i !== col && h !== c.hash) put(i * 2, '│', i) })
    put(col * 2, c.parents.length > 1 ? '○' : '●', col)

    // 其他 lane 也在等這個 commit：匯入節點
    lanes.forEach((h, j) => {
      if (j === col || h !== c.hash) return
      lanes[j] = null
      hline(col * 2, j * 2, j)
      put(j * 2, j > col ? '╯' : '╰', j)
    })

    const segments: Segment[] = []
    above.forEach((h, j) => {
      if (h === c.hash) segments.push({ x1: j, y1: 'top', x2: col, y2: 'mid', lane: j })
      else if (h) segments.push({ x1: j, y1: 'top', x2: j, y2: 'bottom', lane: j })
    })

    const [first, ...others] = c.parents
    lanes[col] = first ?? null
    if (first) segments.push({ x1: col, y1: 'mid', x2: col, y2: 'bottom', lane: col })
    for (const p of others) {
      let k = lanes.indexOf(p)
      const existed = k >= 0 && k !== col
      if (!existed) {
        k = lanes.findIndex((h, i) => h === null && i !== col)
        if (k < 0) k = lanes.length
        lanes[k] = p
      }
      hline(col * 2, k * 2, k)
      // 同列剛匯入的 lane 又被分出去：╯+╮ → ┤
      const joined = existed || cells[k * 2]?.ch === '╯' || cells[k * 2]?.ch === '╰'
      put(k * 2, joined ? (k > col ? '┤' : '├') : (k > col ? '╮' : '╭'), k)
      segments.push({ x1: col, y1: 'mid', x2: k, y2: 'bottom', lane: k })
    }
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()

    return { col, cells, segments }
  })
}

// 桌面版每列一張 SVG：線段頂到列的上下緣，相鄰列才接得起來
export const ROW_H = 24
const LANE_W = 16
const R = 4
export const svgWidth = (lanes: number) => Math.max(56, lanes * LANE_W)

const laneX = (lane: number) => LANE_W / 2 + lane * LANE_W
const Y = { top: 0, mid: ROW_H / 2, bottom: ROW_H } as const

// 未提交變更：灰色虛線接到 HEAD
export const WIP_COLOR = '#808080'
export type Stroke = Segment & { dashed?: boolean }
export type Node = { col: number; color: string; hollow?: boolean }

export function rowSvg(strokes: Stroke[], node: Node, width: number): string {
  const cx = laneX(node.col)
  const paths = strokes.map(s => {
    const [x1, y1, x2, y2] = [laneX(s.x1), Y[s.y1], laneX(s.x2), Y[s.y2]]
    const ym = (y1 + y2) / 2
    const d = x1 === x2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}C${x1} ${ym} ${x2} ${ym} ${x2} ${y2}`
    return s.dashed
      ? `<path d="${d}" stroke="${WIP_COLOR}" stroke-dasharray="3 3"/>`
      : `<path d="${d}" stroke="${laneColor(s.lane)}"/>`
  })
  // 空心節點：mask 挖掉穿進圓心的線
  const mask = node.hollow ? `<mask id="m"><rect width="${width}" height="${ROW_H}" fill="#fff"/><circle cx="${cx}" cy="${Y.mid}" r="${R}" fill="#000"/></mask>` : ''
  const circle = node.hollow
    ? `<circle cx="${cx}" cy="${Y.mid}" r="${R}" fill="none" stroke="${node.color}" stroke-width="2"/>`
    : `<circle cx="${cx}" cy="${Y.mid}" r="${R}" fill="${node.color}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ROW_H}" viewBox="0 0 ${width} ${ROW_H}">${mask}`
    + `<g fill="none" stroke-width="2"${mask ? ' mask="url(#m)"' : ''}>${paths.join('')}</g>${circle}</svg>`
}
