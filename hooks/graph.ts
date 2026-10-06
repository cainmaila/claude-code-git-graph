import type { Cell, Commit, GraphRow, Ref } from '../types'

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

    const [first, ...others] = c.parents
    lanes[col] = first ?? null
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
    }
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()

    return { col, cells }
  })
}
