# AgentUsage

Usage limits of four coding-agent CLIs (Claude Code, Codex, Grok and Antigravity's `agy`) as traffic-light dots in
the VS Code status bar. Click the item for every agent's details.

````
✦ Claude 🟢 5h 27% | 🤖 Codex 🟢 5h 11% | ⚡ Grok 🟢 Weekly 16% | 🚀 Antigravity 🟢 Gemini 5h 8%
````

## The status bar

- **Choosing the dots**: on AgentUsage's settings page (the popup's **Settings** link), check the windows to show in
  `agentUsage.statusBarDots`. Exactly the checked ones show, up to `agentUsage.maxStatusBarDots` (4). The popup's
  **Status bar dots** link opens the same choice as a checklist with live percentages.
- **With nothing checked**, the dots are placed automatically, shared fairly between the agents that have a reading:
  - one agent shows its windows (Claude: 5h, Weekly, Fable);
  - two agents get two dots each;
  - four agents get one each;
  - dots left over go to the first agent in `agentUsage.agents` (Claude by default).
- **Shorter**: turn off `agentUsage.isAgentNameShown` to show each agent's icon without its name:
  `✦ 🟢 5h 27% | 🤖 🟢 5h 11%`. Antigravity's model groups then show as VS Code's brand icons too: `Gemini 5h`
  becomes the Gemini icon and `5h`, and `Claude and GPT 5h` the Claude and OpenAI icons and `5h`. These icons need
  VS Code 1.131 or later.
- **Dot colours**: 🟢 below 80%, 🟡 80–94%, 🔴 from 95%.
- **`$(warning)` beside an agent**: its last read failed. The numbers shown are the last good ones, and the popup says
  why.
- **Click**: opens the usage popup at once. Refresh is its first link.

## The popup

Click the status bar item and the popup opens at once. Every enabled agent appears in it:
- One table per agent: each window's bar, percentage, time to reset and reset time, then when it was last read.
- Under the table: Grok's split between GrokChat and GrokBuild, and Codex's free rate-limit resets.
- A line naming the agents that are not connected, with what to run.
- Links: Refresh, Settings, Status bar dots, Log.

The popup shows the last reading and never reads when it opens. It stays open until you click elsewhere, click one of
its links, or press Escape. Resting the mouse on the item opens the same popup after VS Code's
`workbench.hover.delay` (1500 ms on macOS by default).

## Where the numbers come from

| Agent | Read through | Token |
|---|---|---|
| Claude Code | `GET api.anthropic.com/api/oauth/usage` | Read where Claude Code keeps it (see below). |
| Codex | `codex -s read-only -a never app-server`, JSON-RPC `account/rateLimits/read` | None: Codex reads and renews its own login. |
| Grok | `GET cli-chat-proxy.grok.com/v1/billing?format=credits` | `auth.json` in `GROK_HOME` (default `~/.grok`), used only while unexpired. |
| Antigravity | `agy -p /quota --output-format json`, with `AGY_CLI_DISABLE_AUTO_UPDATE=true` | None: agy signs itself in. |

**Claude Code's token** is taken from the first of these that holds it:
1. `CLAUDE_CODE_OAUTH_TOKEN`.
2. On macOS, the keychain item `Claude Code-credentials`, then `.credentials.json` only when no item exists.
3. On Windows, when Claude Code's Credential Manager rollout is on, the Credential Manager entry
   `Claude Code-credentials/claude-code-user`; otherwise `%USERPROFILE%\.claude\.credentials.json`.

**Grok's token is never renewed.** Its refresh token rotates, and a renewal outside `grok` can sign the CLI out. Grok's
token lives 6 hours, so 6 hours after `grok` last ran, Grok reads "token expired" until `grok` runs again.

**agy's auto-update is off for AgentUsage's reads.** About every 15 minutes, an `agy` run starts agy's background
updater, which on Windows flashes a console window on the desktop. agy still updates itself when you run it.

**What is sent where:** tokens go only to their own service, and are never stored or logged. The usage endpoints are
unofficial and can change without notice.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `agentUsage.statusBarDots` | none checked | one checkbox per window, named `<agent>/<window id>`; none checked places the dots automatically. `session` is the 5-hour window; Antigravity's `3p` is its Claude and GPT group |
| `agentUsage.maxStatusBarDots` | `4` | most dots the status bar shows (1–8) |
| `agentUsage.isAgentNameShown` | on | each agent's name beside its icon; off shows the icons only |
| `agentUsage.agents` | all four | agents to read, in status bar order |
| `agentUsage.refreshIntervalSeconds` | `60` | seconds between reads (at least 30). Each VS Code window reads on its own |
| `agentUsage.codexCommand` | `codex` | the Codex command, on VS Code's PATH or a full path |
| `agentUsage.antigravityCommand` | `agy` | the Antigravity command, on VS Code's PATH or a full path |
| `agentUsage.logVerbosity` | `off` | detail in the **AgentUsage** output channel; errors and warnings always log |

## Commands

- **AgentUsage: Refresh**
- **AgentUsage: Open Settings**
- **AgentUsage: Choose Status Bar Dots**
- **AgentUsage: Show Log**

## Development

- `npm test` runs the tests (`node --test`, no VS Code needed).
- `node tools/read-agent-usage.js` reads every agent once with the extension's readers and prints the result.
- `node tools/mutation-check.js` breaks one rule at a time and reports any rule no test catches.
- `node tools/popup-check.js` opens an isolated VS Code for about half a minute and checks the popup with real mouse
  clicks.
- `npm run package` builds `dist/agent-usage-<version>.vsix`. `dist/` keeps one VSIX per release, so raise `version`
  in `package.json` first, or the build replaces that version's file.
- The design and its tracking are in `plans/agent-usage.md`.

AgentUsage is licensed under the GNU Affero General Public License v3.0 (see `LICENSE`). It is derived from
`ypdev.claude-codex-usage` 0.2.2, whose MIT notice is kept in `LICENSE-claude-codex-usage.txt`.
