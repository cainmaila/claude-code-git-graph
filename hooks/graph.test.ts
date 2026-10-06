import { test, expect } from 'claude-code/testing'

import { layout, parseLog, parseRefs } from './graph'

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
