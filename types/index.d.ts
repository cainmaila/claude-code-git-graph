export type Ref =
  | { kind: 'branch'; name: string; remotes: string[]; isHead: boolean }
  | { kind: 'remote'; name: string }
  | { kind: 'tag'; name: string }
  | { kind: 'detached' }

export type Commit = {
  hash: string
  parents: string[]
  refs: Ref[]
  author: string
  time: number
  subject: string
}

export type Cell = { ch: string; lane: number }
// x 為 lane index；y 為列的上緣、節點中線或下緣
export type Segment = { x1: number; y1: 'top' | 'mid'; x2: number; y2: 'mid' | 'bottom'; lane: number }
export type GraphRow = { col: number; cells: Cell[]; segments: Segment[] }

declare module 'claude-code' {
  interface PluginState {
    'git-graph': {
      commits: Commit[]
      dirty: number
      selected: string
      branches: string[]
      remoteBranches: string[]
      remotes: string[]
      remote: string
      armed: string
    }
  }
}
