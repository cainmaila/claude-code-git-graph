<p align="center">
  <img src="assets/logo.svg" width="96" alt="Git Graph logo">
</p>

<h1 align="center">Git Graph for Claude Code</h1>

<p align="center">
  <b>See your branches. Switch, tag and push without leaving Claude Code.</b><br>
  A <a href="https://github.com/mhutchie/vscode-git-graph">vscode-git-graph</a>-style commit graph that lives in a pane next to your conversation.
</p>

<p align="center">
  <b>English</b> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="assets/screenshot.svg" alt="Git Graph pane in Claude Code" width="100%">
</p>

## Why

Claude edits your code and runs `git` for you, but the terminal only ever shows you one line of history at a time. Git Graph puts the whole picture on screen: colored lanes, merges, branches, remotes and tags. You can act on any commit with one keypress.

- **Real lane layout.** Every branch gets its own color, and merges and forks draw as proper curves, not ASCII soup.
- **Refs as pills.** Local branches are merged with their `origin` twin, `◉` marks HEAD, `◆` marks tags, and remote-only branches stand out.
- **A table you can scan.** Graph · Description · Date · Author · Commit columns. Merge commits are dimmed, and uncommitted changes are pinned to the top.
- **Stays in sync.** Whenever Claude runs a `git` command, the graph refreshes itself.
- **Fits narrow panes.** Long ref names are shortened and secondary columns fold away when space runs out.

## What you can do

| | Action | How |
|---|---|---|
| ⎇ | Switch to **any branch** (local or remote-only) | Branch picker in the header. Remote-only branches are tracked automatically with `git switch --track` |
| ⎋ | Check out **any commit** | Select a commit → `checkout <hash>` (detached HEAD) |
| ◆ | **Create** a tag | Select a commit → type a name in `◆ new tag` → Enter |
| ◆ | **Rename** a tag | `rename` field on the tag row. Annotated tags keep their message |
| ✕ | **Delete** a tag (local / remote) | `✕ delete` / `✕ origin`, pressed twice to confirm |
| ↑ | **Push** branches and tags | `p` pushes the current branch (with `-u`); `↑ push` on any branch or tag; choose the remote in the header |

## Install

```sh
claude plugin marketplace add cainmaila/claude-code-git-graph
claude plugin install git-graph@git-graph
```

Then, in any Claude Code session:

```
/git-graph
```

Already in a session? Run `/reload-plugins` first.

## Keys

| Key | Does |
|---|---|
| `j` / `k` | Move the selection down / up |
| click a hash | Select / deselect that commit |
| `p` | Push the current branch to the selected remote |
| `r` | Refresh |
| `x` | Close the commit details |
| `q` / `Esc` | Close the pane |

## Safety

- Every git command runs with its arguments passed directly. Nothing is interpolated into a shell.
- Tag names are validated with `git check-ref-format`, and names starting with `-` are rejected.
- Destructive actions (deleting a tag locally or on the remote) require a second press.
- Pushes never hang waiting for a password (`GIT_TERMINAL_PROMPT=0`). Set up SSH keys or a credential helper.
- No force-push, reset, rebase or branch deletion. Git Graph will never rewrite your history.

## Requirements

- Claude Code with plugin function hooks (mods): 2.1.291 or newer
- `git` on your `PATH`

## Development

```sh
git clone git@github.com:cainmaila/claude-code-git-graph.git
claude --plugin-dir ./claude-code-git-graph   # hot-reloads as you edit
claude plugin test ./claude-code-git-graph    # lane layout + pane render tests
claude plugin validate ./claude-code-git-graph
```

| File | Role |
|---|---|
| `hooks/register.tsx` | Command, pane rendering, git actions |
| `hooks/graph.ts` | `git log` parsing and the lane layout algorithm |
| `types/index.d.ts` | Pane state contract |

## Uninstall

```sh
claude plugin uninstall git-graph@git-graph
```

---

<p align="center">Inspired by <a href="https://github.com/mhutchie/vscode-git-graph">mhutchie/vscode-git-graph</a> · Built as a Claude Code mod</p>
