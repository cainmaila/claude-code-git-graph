import { test, expect } from 'claude-code/testing'

import { layout, parseLog, parseRefs, rowSvg } from './graph'

const c = (hash: string, parents: string[]) => ({ hash, parents, refs: [], author: '', time: 0, subject: '' })
const text = (rows: ReturnType<typeof layout>) => rows.map(r => r.cells.map(x => x.ch).join('').trimEnd())

test('linear history stays in lane 0', () => {
  const rows = layout([c('c', ['b']), c('b', ['a']), c('a', [])])
  expect(rows.map(r => r.col)).toEqual([0, 0, 0])
  expect(text(rows)).toEqual(['●', '●', '●'])
})

test('fork and merge draw ╮ and ╯', () => {
  // m 合併 x（側枝）回 b；x 與 b 都來自 a
  const rows = layout([c('m', ['b', 'x']), c('x', ['a']), c('b', ['a']), c('a', [])])
  expect(text(rows)).toEqual(['○─╮', '│ ●', '● │', '●─╯'])
  expect(rows[1]!.col).toBe(1)
})

test('lane merged in and reused on same row draws ┤', () => {
  // m2 合併側枝 y；y 的 parent 是 m1，m1 又合併 x
  const rows = layout([c('m2', ['m1', 'y']), c('y', ['m1']), c('m1', ['a', 'x']), c('x', ['a']), c('a', [])])
  expect(text(rows)[2]).toBe('○─┤')
})

test('segments meet at row edges so adjacent rows connect', () => {
  // m 合併 x 回 b；x 與 b 都來自 a
  const rows = layout([c('m', ['b', 'x']), c('x', ['a']), c('b', ['a']), c('a', [])])
  const seg = (r: (typeof rows)[number]) => r.segments.map(s => `${s.x1}${s.y1[0]}-${s.x2}${s.y2[0]}`).sort()
  expect(seg(rows[0]!)).toEqual(['0m-0b', '0m-1b'])
  expect(seg(rows[1]!)).toEqual(['0t-0b', '1m-1b', '1t-1m'])
  expect(seg(rows[2]!)).toEqual(['0m-0b', '0t-0m', '1t-1b'])
  expect(seg(rows[3]!)).toEqual(['0t-0m', '1t-0m'])
  // 從上緣進來的每條線，上一列都有一條從下緣出去
  for (let i = 1; i < rows.length; i++) {
    const out = [...new Set(rows[i - 1]!.segments.filter(s => s.y2 === 'bottom').map(s => s.x2))].sort()
    const into = rows[i]!.segments.filter(s => s.y1 === 'top').map(s => s.x1).sort()
    expect(into).toEqual(out)
  }
})

test('rowSvg curves lane changes and hollows the head node', () => {
  const [merge] = layout([c('m', ['b', 'x']), c('x', ['a']), c('b', ['a']), c('a', [])])
  const svg = rowSvg(merge!.segments, { col: 0, color: '#0085d9', hollow: true }, 56)
  expect(svg).toContain('<path d="M8 12V24"')
  expect(svg).toContain('<path d="M8 12C8 18 24 18 24 24"')
  expect(svg).toContain('mask="url(#m)"')
  expect(svg).toContain('fill="none" stroke="#0085d9"')
})

test('refs: head, merged remote, lone remote, tag', () => {
  const refs = parseRefs('HEAD -> main, origin/main, origin/HEAD, feat/x, cainmaila/dev, tag: v1', ['origin', 'cainmaila'])
  expect(refs).toEqual([
    { kind: 'branch', name: 'main', remotes: ['origin'], isHead: true },
    { kind: 'branch', name: 'feat/x', remotes: [], isHead: false },
    { kind: 'remote', name: 'cainmaila/dev' },
    { kind: 'tag', name: 'v1' },
  ])
})

test('parseLog splits fields', () => {
  const [one] = parseLog('abc\x1fp1 p2\x1f\x1fCain\x1f100\x1fMerge #1\n', [])
  expect(one).toEqual({ hash: 'abc', parents: ['p1', 'p2'], refs: [], author: 'Cain', time: 100, subject: 'Merge #1' })
})
