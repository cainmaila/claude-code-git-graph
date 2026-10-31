import { test, expect } from 'claude-code/testing'

// 合成 demo repo 的 git 輸出：畫出 pane 與展開 commit 詳細都不可拋錯
const OUT: Record<string, string> = {
  log: "ebcd1cc8f398d59483491af87967d830a3a0cb28\u001f080dd0ea1d725203560ecb9f4852f31660b34367\u001ffeat/tag-crud\u001fLinus\u001f1790046800\u001fwip: remote tag deletion\nffa49f1cadb7982ff55c07be73db88359e1f5a60\u001f22e1e26ea107735f9b8fe88ae1ceaa06bf71bbbe\u001fHEAD -> main, origin/main\u001fLinus\u001f1790043200\u001fchore: bump deps\n080dd0ea1d725203560ecb9f4852f31660b34367\u001fc8bf0e0811b7bd5ba6fbfe5414f5500cc091f05c\u001forigin/feat/tag-crud\u001fGrace\u001f1790039600\u001ffeat: push tags to remote\nc8bf0e0811b7bd5ba6fbfe5414f5500cc091f05c\u001f22e1e26ea107735f9b8fe88ae1ceaa06bf71bbbe\u001f\u001fGrace\u001f1790036000\u001ffeat: create, rename and delete tags\n22e1e26ea107735f9b8fe88ae1ceaa06bf71bbbe\u001fcb2b47f7b3298fa81eb2adfd654a11682c56689a dce01795753b6496f1db1d6fd16239b7f8d1998d\u001ftag: v0.2.0\u001fGrace\u001f1790032400\u001fMerge pull request #14 from fix/narrow-pane\ncb2b47f7b3298fa81eb2adfd654a11682c56689a\u001f9c1e45fcfdc8e1ef6678f98d5940bd615ac7ecb7\u001f\u001fGrace\u001f1790028800\u001fperf: coalesce same-color spans\n9c1e45fcfdc8e1ef6678f98d5940bd615ac7ecb7\u001f57dd6ad7d40241eb725e84bc714b2eebe8f212f6 b26bee408dc9a2f7c7432a3036ee1593096710b2\u001f\u001fAda\u001f1790025200\u001fMerge pull request #12 from feat/graph-lanes\ndce01795753b6496f1db1d6fd16239b7f8d1998d\u001f57dd6ad7d40241eb725e84bc714b2eebe8f212f6\u001forigin/fix/narrow-pane\u001fAda\u001f1790021600\u001ffix: truncate refs on narrow panes\n57dd6ad7d40241eb725e84bc714b2eebe8f212f6\u001fbe64671097c7a0345251b2afd5a29cda088d2a6e\u001f\u001fAda\u001f1790018000\u001fdocs: getting started guide\nb26bee408dc9a2f7c7432a3036ee1593096710b2\u001fd9285341757064a5e8a6344254c5aed0333a70ea\u001ffeat/graph-lanes\u001fAda\u001f1790014400\u001ftest: fork and merge cases\nd9285341757064a5e8a6344254c5aed0333a70ea\u001fbe64671097c7a0345251b2afd5a29cda088d2a6e\u001f\u001fAda\u001f1790010800\u001ffeat: lane layout engine\nbe64671097c7a0345251b2afd5a29cda088d2a6e\u001fa57e638b354162a2fe2b106c5bb68c4e4bb12cb6\u001ftag: v0.1.0\u001fAda\u001f1790007200\u001ffeat: project scaffold\na57e638b354162a2fe2b106c5bb68c4e4bb12cb6\u001f\u001f\u001fAda\u001f1790003600\u001fchore: initial commit\n",
  branch: "feat/graph-lanes\nfeat/tag-crud\nmain\n",
  'branch -r': "origin/feat/tag-crud\norigin/fix/narrow-pane\norigin/main\n",
  remote: "origin\n",
  status: '?? dirty.txt\n',
}

test('pane draws and expands a commit', async ($, on) => {
  on('process.run', async (_$, e) => {
    const a = e.argv.slice(1)
    const key = a[0] === 'branch' && a[1] === '-r' ? 'branch -r' : a[0]!
    return { value: { exitCode: 0, stdout: OUT[key] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', async () => ({ value: { isPlaced: true } as never }))
  on('ui.toast', async () => ({ value: {} as never }))
  await $.command.run({ command: 'git-graph', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'git-graph', surface, component: 'Pane', requestId: 'git-graph', props: {} as never, viewport: { columns: 100, rows: 40 } })
    expect(await ui.find({ key: 'branch' })).toBeDefined()
    // 選取狀態跨 surface 共用：已展開就不再按（再按會取消選取）
    if (!(await ui.find({ key: 'tag:new' }))) await ui.press({ key: 'c:22e1e26ea107735f9b8fe88ae1ceaa06bf71bbbe' })
    expect(await ui.find({ key: 'tag:new' })).toBeDefined()
    await ui.unmount()
  }
})

test('clicking a row description opens and closes its details', async ($, on) => {
  on('process.run', async (_$, e) => {
    const stdout = e.argv[1] === 'log' ? 'aaaa\u001f\u001f\u001fAda\u001f1790003600\u001ffirst commit\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', async () => ({ value: { isPlaced: true } as never }))
  on('ui.toast', async () => ({ value: {} as never }))
  await $.command.run({ command: 'git-graph', args: '' } as never)
  const ui = await $.ui.mount({ plugin: 'git-graph', surface: 'desktop', component: 'Pane', requestId: 'git-graph', props: {} as never, viewport: { columns: 100, rows: 40 } })
  expect(await ui.find({ key: 'details' })).toBeUndefined()
  await ui.press({ key: 'd:aaaa' })
  expect(await ui.find({ key: 'details' })).toBeDefined()
  await ui.press({ key: 'd:aaaa' })
  expect(await ui.find({ key: 'details' })).toBeUndefined()
  await ui.unmount()
})

test('desktop clips a long subject to one line; terminal keeps it whole', async ($, on) => {
  const long = 'corrigido case de alguns includes que faziam com que os caminhos não fossem encontrados no linux'
  on('process.run', async (_$, e) => {
    const stdout = e.argv[1] === 'log' ? `aaaa\u001f\u001f\u001fAda\u001f1790003600\u001f${long}\n` : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', async () => ({ value: { isPlaced: true } as never }))
  on('ui.toast', async () => ({ value: {} as never }))
  await $.command.run({ command: 'git-graph', args: '' } as never)
  const mount = (surface: 'terminal' | 'desktop') =>
    $.ui.mount({ plugin: 'git-graph', surface, component: 'Pane', requestId: 'git-graph', props: {} as never, viewport: { columns: 100, rows: 40 } })

  const desktop = await mount('desktop')
  const clipped = await desktop.find({ type: 'Text', text: /^corrigido case.*…$/ })
  expect(clipped?.text.length).toBeLessThan(long.length)
  expect(await desktop.find({ type: 'Text', text: /no linux$/ })).toBeUndefined()
  await desktop.unmount()

  const terminal = await mount('terminal')
  expect(await terminal.find({ type: 'Text', text: /^corrigido case.*no linux$/ })).toBeDefined()
  await terminal.unmount()
})
