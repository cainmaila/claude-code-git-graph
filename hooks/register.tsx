import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cell, Commit, Ref } from '../types'
import { layout, laneColor, parseLog } from './graph'

const PANE = 'git-graph'
const commits = atom({ plugin: 'git-graph', key: 'commits' } as const, [])
const dirty = atom({ plugin: 'git-graph', key: 'dirty' } as const, 0)
const selected = atom({ plugin: 'git-graph', key: 'selected' } as const, '')
const branches = atom({ plugin: 'git-graph', key: 'branches' } as const, [])
const remoteBranches = atom({ plugin: 'git-graph', key: 'remoteBranches' } as const, [])
const remotes = atom({ plugin: 'git-graph', key: 'remotes' } as const, [])
// push 目標 remote
const remote = atom({ plugin: 'git-graph', key: 'remote' } as const, '')
// 兩段式確認中的危險動作 key
const armed = atom({ plugin: 'git-graph', key: 'armed' } as const, '')

const HOVER = '#1e2230'
const SELECTED = '#2b3245'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (t: number) => {
  const d = new Date(t * 1000)
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// hex 顏色乘上係數，給 remote 段落用的深色底
const shade = (hex: string, f: number) =>
  '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')

const lines = (out: string) => out.split('\n').filter(Boolean)

async function git($: EngineInterface, args: string[]) {
  return $.process.run(['git', ...args])
}

// 網路操作：不讓 git 等帳密輸入卡住，逾時放寬
async function gitNet($: EngineInterface, args: string[]) {
  return $.process.run(['git', ...args], { env: { GIT_TERMINAL_PROMPT: '0' }, timeoutMs: 120_000 })
}

async function validTag($: EngineInterface, name: string) {
  if (!name || name.startsWith('-')) return false
  return (await git($, ['check-ref-format', `refs/tags/${name}`])).exitCode === 0
}

async function refresh($: EngineInterface) {
  const rem = await git($, ['remote'])
  const log = await git($, ['log', '--all', '--date-order', '-n', '300', '--format=%H%x1f%P%x1f%D%x1f%an%x1f%at%x1f%s'])
  const status = await git($, ['status', '--porcelain'])
  if (log.exitCode !== 0) {
    await $.ui.toast(log.stderr.trim() || 'not a git repository')
    return
  }
  const local = await git($, ['branch', '--format=%(refname:short)'])
  const remote_ = await git($, ['branch', '-r', '--format=%(refname:short)'])
  const names = lines(rem.stdout)
  await update($, commits, () => parseLog(log.stdout, names))
  await update($, dirty, () => lines(status.stdout).length)
  await update($, branches, () => lines(local.stdout))
  // 去掉 origin/HEAD 這類 symref（short 格式會印成 "origin"）
  await update($, remoteBranches, () => lines(remote_.stdout).filter(b => b.includes('/') && !b.endsWith('/HEAD')))
  await update($, remotes, () => names)
  await update($, remote, r => (names.includes(r) ? r : names.includes('origin') ? 'origin' : (names[0] ?? '')))
}

// 執行 git 動作、toast 結果、重抓圖
async function act($: EngineInterface, ok: string, args: string[]) {
  const r = args[0] === 'push' ? await gitNet($, args) : await git($, args)
  await $.ui.toast(r.exitCode === 0 ? ok : (r.stderr.trim() || `git ${args[0]} failed`))
  await refresh($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'git-graph', description: 'Show git graph; switch branches and add tags' })

    return next(e)
  })

  on('command.run', { command: 'git-graph' }, async $ => {
    // 先開：使用者指令觸發的 open 才能在任何寬度落座，資料隨後補上
    const opened = await $.ui.open({ id: PANE, title: 'Git Graph', focus: true, closeOnEscape: true })
    refresh($).catch(() => {})

    return { text: opened.isPlaced ? 'Git Graph opened.' : `Git Graph not shown: ${opened.reason}` }
  })

  // Claude 跑過 git 指令後自動更新圖
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (/\bgit\b/.test(e.command)) refresh($).catch(() => {})

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text, Button } = el
    // mobile 沒有 Input
    const Input = 'Input' in el ? el.Input : undefined
    const list = await read($, commits)
    const changes = await read($, dirty)
    const sel = await read($, selected)
    const local = await read($, branches)
    const remoteOnly = (await read($, remoteBranches)).filter(r => !local.includes(r.slice(r.indexOf('/') + 1)))
    const remoteNames = await read($, remotes)
    const target = await read($, remote)
    const armedKey = await read($, armed)
    const Select = 'Select' in el ? el.Select : undefined
    const rows = layout(list)
    const width = e.viewport?.columns ?? 120
    const wide = width >= 90
    const lanes = Math.max(1, ...rows.map(r => r.cells.length))
    const graphW = Math.min(lanes + 2, Math.floor(width / 4))
    const selIdx = list.findIndex(c => c.hash === sel)
    const picked = list[selIdx]
    const head = list.findIndex(c => c.refs.some(r => (r.kind === 'branch' && r.isHead) || r.kind === 'detached'))
    const headCol = rows[head]?.col ?? 0
    const headName = list[head]?.refs.flatMap(r => (r.kind === 'branch' && r.isHead ? [r.name] : []))[0]

    const room = Math.max(3, (e.viewport?.rows ?? 30) - 6 - (changes ? 1 : 0) - (picked ? 7 + picked.refs.filter(r => r.kind === 'tag').length : 0))
    const start = Math.max(0, Math.min(selIdx - Math.floor(room / 2), list.length - room))
    const move = (d: number) =>
      update($, selected, s => list[Math.max(0, Math.min(list.length - 1, list.findIndex(c => c.hash === s) + d))]?.hash ?? s)

    // 同色連續字元合成一段，壓低節點數
    const graph = (cells: Cell[]) => {
      const spans: { text: string; lane: number }[] = []
      for (const c of cells) {
        const last = spans[spans.length - 1]
        if (last && last.lane === c.lane) last.text += c.ch
        else spans.push({ text: c.ch, lane: c.lane })
      }
      return spans.map(s => <Text mono color={s.lane < 0 ? undefined : laneColor(s.lane)}>{s.text}</Text>)
    }

    // 窄面板時壓短 ref 名，避免吃光描述
    const maxRef = Math.max(10, Math.floor(width / 4))
    const clip = (s: string) => (s.length > maxRef ? s.slice(0, maxRef - 1) + '…' : s)
    const pill = (ref: Ref, color: string) => {
      if (ref.kind === 'tag') return <Text><Text backgroundColor="#3a3420" color="#f2c94c"> ◆ {clip(ref.name)} </Text> </Text>
      if (ref.kind === 'detached') return <Text><Text backgroundColor={color} color="#000" bold> ◉ HEAD </Text> </Text>
      if (ref.kind === 'remote') {
        const slash = ref.name.indexOf('/')
        return (
          <Text>
            <Text backgroundColor={shade(color, 0.3)} color={color} bold> {clip(ref.name.slice(slash + 1))} </Text>
            <Text backgroundColor={shade(color, 0.45)} color="#fff" italic> {ref.name.slice(0, slash)} </Text>{' '}
          </Text>
        )
      }
      return (
        <Text>
          <Text backgroundColor={color} color="#000" bold> {ref.isHead ? '◉ ' : ''}{clip(ref.name)} </Text>
          {ref.remotes.length > 0 && <Text backgroundColor={shade(color, 0.45)} color="#fff" italic> {ref.remotes.join(' ')} </Text>}
          {' '}
        </Text>
      )
    }

    const columns = (date: string, author: string, dim: boolean) => [
      wide && <Box width={13} flexShrink={0}><Text dimColor={dim}>{date}</Text></Box>,
      wide && <Box width={12} flexShrink={0}><Text dimColor={dim} wrap="truncate-end">{author}</Text></Box>,
    ]

    const row = (c: Commit, i: number) => {
      const isSel = c.hash === sel
      const isMerge = c.parents.length > 1
      const color = laneColor(rows[i]!.col)
      return (
        <Box key={`row:${c.hash}`} columnGap={1} backgroundColor={isSel ? SELECTED : undefined} hover={{ backgroundColor: HOVER }}>
          <Box width={graphW} flexShrink={0} overflow="hidden"><Text mono>{graph(rows[i]!.cells)}</Text></Box>
          <Box flexGrow={1} flexShrink={1} overflow="hidden">
            <Text wrap="truncate-end">
              {c.refs.map(r => pill(r, color))}
              <Text dimColor={isMerge && !isSel} bold={isSel}>{c.subject}</Text>
            </Text>
          </Box>
          {columns(fmtDate(c.time), c.author, isMerge)}
          <Box width={8} flexShrink={0}>
            <Button key={`c:${c.hash}`} plain dimColor={!isSel} onPress={() => void update($, selected, s => (s === c.hash ? '' : c.hash))}>
              {c.hash.slice(0, 8)}
            </Button>
          </Box>
        </Box>
      )
    }

    // 危險動作：第一次按只上膛，第二次才執行
    const confirm = (key: string, run: () => Promise<void>) => async () => {
      if (armedKey !== key) {
        await update($, armed, () => key)
        return void $.ui.toast('Press again to confirm')
      }
      await update($, armed, () => '')
      await run()
    }

    const actions = (c: Commit) => {
      const here = c.refs.flatMap(r => (r.kind === 'branch' ? [r] : []))
      const switches = [
        ...here.filter(r => !r.isHead).map(r => ({ label: r.name, args: ['switch', r.name] })),
        ...c.refs.flatMap(r => (r.kind === 'remote' ? [{ label: r.name, args: ['switch', '--track', r.name] }] : [])),
      ]
      const tags = c.refs.flatMap(r => (r.kind === 'tag' ? [r.name] : []))
      const short = c.hash.slice(0, 8)
      const color = laneColor(rows[selIdx]!.col)
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
          <Box gap={2}>
            <Text color={color} bold>{c.hash}</Text>
            <Text dimColor>{c.author}</Text>
            <Text dimColor>{fmtDate(c.time)}</Text>
          </Box>
          <Text wrap="truncate-end">{c.subject}</Text>
          <Box columnGap={1} flexWrap="wrap">
            {switches.map(s => (
              <Button key={`sw:${s.label}`} variant="primary" onPress={() => void act($, `switched to ${s.label}`, s.args)}>
                {`⎇ ${s.label}`}
              </Button>
            ))}
            {target && here.map(b => (
              <Button key={`pb:${b.name}`} onPress={() => void act($, `pushed ${b.name} → ${target}`, ['push', '-u', target, b.name])}>
                {`↑ push ${b.name}`}
              </Button>
            ))}
            <Button key="detach" onPress={() => void act($, `detached at ${short}`, ['switch', '--detach', c.hash])}>
              {`checkout ${short}`}
            </Button>
          </Box>
          {Input && (
            <Input
              key="tag:new"
              label="◆ new tag"
              placeholder="v1.2.3"
              submitLabel="create"
              onSubmit={async (name: string) => {
                const tag = name.trim()
                if (!(await validTag($, tag))) return void $.ui.toast(`invalid tag name: ${tag}`)
                await act($, `tagged ${short} as ${tag}`, ['tag', tag, c.hash])
              }}
            />
          )}
          {tags.map(tag => (
            <Box key={`tagrow:${tag}`} columnGap={1}>
              <Text backgroundColor="#3a3420" color="#f2c94c"> ◆ {clip(tag)} </Text>
              {target && (
                <Button key={`tp:${tag}`} plain onPress={() => void act($, `pushed tag ${tag} → ${target}`, ['push', target, `refs/tags/${tag}`])}>
                  ↑ push
                </Button>
              )}
              <Button key={`td:${tag}`} plain onPress={() => void confirm(`td:${tag}`, () => act($, `deleted tag ${tag}`, ['tag', '-d', tag]))()}>
                {armedKey === `td:${tag}` ? '✕ confirm delete?' : '✕ delete'}
              </Button>
              {target && (
                <Button
                  key={`tr:${tag}`}
                  plain
                  onPress={() => void confirm(`tr:${tag}`, () => act($, `deleted tag ${tag} on ${target}`, ['push', target, '--delete', `refs/tags/${tag}`]))()}
                >
                  {armedKey === `tr:${tag}` ? `✕ confirm delete on ${target}?` : `✕ ${target}`}
                </Button>
              )}
              {Input && (
                <Input
                  key={`tn:${tag}`}
                  label="rename"
                  placeholder={tag}
                  submitLabel="rename"
                  onSubmit={async (name: string) => {
                    const next = name.trim()
                    if (next === tag) return
                    if (!(await validTag($, next))) return void $.ui.toast(`invalid tag name: ${next}`)
                    // annotated tag 保留訊息；lightweight 直接指向同一 commit
                    const kind = await git($, ['cat-file', '-t', `refs/tags/${tag}`])
                    const msg = await git($, ['tag', '-l', '--format=%(contents)', tag])
                    const made = kind.stdout.trim() === 'tag'
                      ? await git($, ['tag', '-a', next, c.hash, '-m', msg.stdout.trim() || next])
                      : await git($, ['tag', next, c.hash])
                    if (made.exitCode !== 0) return void $.ui.toast(made.stderr.trim() || 'rename failed')
                    await act($, `renamed ${tag} → ${next} (push/delete on the remote separately)`, ['tag', '-d', tag])
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box columnGap={2}>
          <Box flexGrow={1} flexShrink={1} overflow="hidden">
            <Text bold wrap="truncate-end">
              {headName ? <Text color={laneColor(headCol)}>◉ {headName}</Text> : <Text color="warning">◉ detached</Text>}
              <Text dimColor> · {list.length}</Text>
            </Text>
          </Box>
          <Box flexShrink={0} columnGap={2}>
            <Button key="up" plain hotkey="k" onPress={() => void move(-1)}>↑</Button>
            <Button key="down" plain hotkey="j" onPress={() => void move(1)}>↓</Button>
            <Button key="refresh" plain hotkey="r" onPress={() => void refresh($)}>⟳</Button>
            {picked && <Button key="close" plain hotkey="x" onPress={() => void update($, selected, () => '')}>✕</Button>}
            <Button key="quit" plain hotkey="q" onPress={() => void $.ui.close({ id: PANE })}>Close</Button>
          </Box>
        </Box>
        <Box columnGap={2} flexWrap="wrap">
          {Select && local.length + remoteOnly.length > 0 && (
            <Select
              key="branch"
              label="⎇"
              value={headName}
              options={[...local.map(b => ({ value: b })), ...remoteOnly.map(b => ({ value: b, label: `${b} (remote)` }))]}
              onSelect={(b: string) =>
                void act($, `switched to ${b}`, local.includes(b) ? ['switch', b] : ['switch', '--track', b])}
            />
          )}
          {Select && remoteNames.length > 1 && (
            <Select key="remote" label="remote" value={target} options={remoteNames.map(r => ({ value: r }))} onSelect={(r: string) => void update($, remote, () => r)} />
          )}
          {headName && target && (
            <Button key="push" plain hotkey="p" onPress={() => void act($, `pushed ${headName} → ${target}`, ['push', '-u', target, headName])}>
              {`push ${headName} → ${target}`}
            </Button>
          )}
        </Box>
        <Box columnGap={1}>
          <Box width={graphW} flexShrink={0}><Text bold dimColor>Graph</Text></Box>
          <Box flexGrow={1}><Text bold dimColor>Description</Text></Box>
          {wide && <Box width={13} flexShrink={0}><Text bold dimColor>Date</Text></Box>}
          {wide && <Box width={12} flexShrink={0}><Text bold dimColor>Author</Text></Box>}
          <Box width={8} flexShrink={0}><Text bold dimColor>Commit</Text></Box>
        </Box>
        <Box height={1} overflow="hidden"><Text dimColor wrap="wrap">{'─'.repeat(width)}</Text></Box>
        {changes > 0 && start === 0 && (
          <Box key="row:wip" columnGap={1} hover={{ backgroundColor: HOVER }}>
            <Box width={graphW} flexShrink={0}>
              <Text mono>{' '.repeat(headCol * 2)}<Text color={laneColor(headCol)}>◌</Text></Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}><Text bold wrap="truncate-end">Uncommitted Changes ({changes})</Text></Box>
            {columns(fmtDate(Date.now() / 1000), '*', false)}
            <Box width={8} flexShrink={0}><Text dimColor>*</Text></Box>
          </Box>
        )}
        {list.slice(start, start + room).map((c, i) => row(c, start + i))}
        {picked && actions(picked)}
      </Box>
    )
  })
}
