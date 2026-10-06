<p align="center">
  <img src="assets/logo.svg" width="96" alt="Git Graph logo">
</p>

<h1 align="center">Git Graph for Claude Code</h1>

<p align="center">
  <b>分支一目了然。不離開 Claude Code，就能切換、打 tag、推送。</b><br>
  <a href="https://github.com/mhutchie/vscode-git-graph">vscode-git-graph</a> 風格的 commit 圖，就放在對話旁邊的面板裡。
</p>

<p align="center">
  <a href="README.md">English</a> · <b>繁體中文</b> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="assets/screenshot.svg" alt="Claude Code 中的 Git Graph 面板" width="100%">
</p>

## 為什麼需要它

Claude 會幫你改程式、跑 `git`，但終端機一次只讓你看到一行歷史。Git Graph 把整張圖攤開：彩色分支線、merge、分支、遠端和 tag 都看得到，而且任何一個 commit 都能一鍵操作。

- **真正的 lane 排版**：每條分支有自己的顏色，merge 和分岔畫成平順的曲線，不是一堆 ASCII 字元。
- **Ref 標籤**：本地分支和同名的 `origin` 分支合成一個標籤；`◉` 標示目前的 HEAD，`◆` 標示 tag；只存在遠端的分支會另外標出來。
- **好掃讀的表格**：分成 Graph、Description、Date、Author、Commit 五欄。merge commit 淡色顯示，尚未 commit 的變更固定在最上面。
- **自動同步**：Claude 每跑一次 `git` 指令，圖就自動更新。
- **窄面板也能看**：過長的分支名會自動截短，空間不夠時次要欄位會自動收起。

## 能做什麼

| | 動作 | 怎麼做 |
|---|---|---|
| ⎇ | 切換到**任意分支**（本地或僅遠端） | 頂部的分支選單。僅遠端的分支會自動用 `git switch --track` 建立本地追蹤 |
| ⎋ | 切到**任意 commit** | 選取 commit 後按 `checkout <hash>`（detached HEAD） |
| ◆ | **新增** tag | 選取 commit 後在 `◆ new tag` 輸入名稱，按 Enter |
| ◆ | **重新命名** tag | tag 那一列的 `rename` 欄位，有附訊息的 tag 會保留原訊息 |
| ✕ | **刪除** tag（本地／遠端） | `✕ delete`／`✕ origin`，要按兩次確認 |
| ↑ | **推送**分支與 tag | `p` 推送目前分支（帶 `-u`）；任何分支或 tag 都有 `↑ push`；推到哪個 remote 可以在頂部選 |

## 安裝

```sh
claude plugin marketplace add cainmaila/claude-code-git-graph
claude plugin install git-graph@git-graph
```

之後在任何 Claude Code session 輸入：

```
/git-graph
```

如果 session 已經開著，先執行 `/reload-plugins`。

## 快捷鍵

| 按鍵 | 功能 |
|---|---|
| `j` / `k` | 選取往下／往上移 |
| 點 hash | 選取／取消選取該 commit |
| `p` | 把目前分支推送到選定的 remote |
| `r` | 重新整理 |
| `x` | 關閉 commit 詳細面板 |
| `q` / `Esc` | 關閉整個面板 |

## 安全性

- 所有 git 指令的參數都直接傳給 git，不經過 shell 字串拼接。
- tag 名稱會先用 `git check-ref-format` 檢查，開頭是 `-` 的名稱一律拒絕。
- 破壞性的動作（刪除本地或遠端的 tag）都要按第二次才會執行。
- 推送時不會卡在等密碼（`GIT_TERMINAL_PROMPT=0`），請事先設定好 SSH key 或 credential helper。
- 不提供 force push、reset、rebase，也不能刪除分支。Git Graph 絕不改寫你的歷史。

## 需求

- 支援 plugin function hooks（mods）的 Claude Code：2.1.291 以上
- `PATH` 中可以執行 `git`

## 開發

```sh
git clone git@github.com:cainmaila/claude-code-git-graph.git
claude --plugin-dir ./claude-code-git-graph   # 改檔即熱重載
claude plugin test ./claude-code-git-graph    # lane 排版與面板繪製測試
claude plugin validate ./claude-code-git-graph
```

| 檔案 | 用途 |
|---|---|
| `hooks/register.tsx` | 指令、面板繪製、git 操作 |
| `hooks/graph.ts` | 解析 `git log` 與 lane 排版演算法 |
| `types/index.d.ts` | 面板狀態的型別定義 |

## 授權

[MIT](LICENSE)

## 移除

```sh
claude plugin uninstall git-graph@git-graph
```

---

<p align="center">靈感來自 <a href="https://github.com/mhutchie/vscode-git-graph">mhutchie/vscode-git-graph</a> · 以 Claude Code mod 打造</p>
