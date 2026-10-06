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
export type GraphRow = { col: number; cells: Cell[] }

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
