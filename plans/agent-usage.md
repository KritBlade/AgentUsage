# AgentUsage — one status bar item for the usage limits of every coding-agent CLI

**v0.9 — AgentUsage's own icon; a click opens the usage popup at once and a click on any of its links closes it; the
dots are chosen on the settings page; names can be hidden; reads run every minute.**
- **Its own icon** (D19): four slanted usage meters, one colour per agent, on upstream's dark rounded tile:
  Claude orange, Codex white, Grok violet, Antigravity blue.
- **A click on the status bar item opens the popup at once** (D17): 23–50 ms, measured in an isolated VS Code 1.146
  driven with real mouse events. Resting the mouse still opens it, after VS Code's 1500 ms on macOS. Refresh moved from
  the click to the popup's first link.
- **Each of the popup's links closes it before acting** (D18), and the item stays between the same neighbours.
- The popup's new **Settings** link opens AgentUsage's settings page (D14).
- `agentUsage.statusBarDots` is one checkbox per window:
  - With none checked, the dots are placed automatically (D2, D10).
  - With any checked, exactly those show.
  - It replaces the four `agentUsage.<agent>.dots` orders and `agentUsage.extraDots`. **AgentUsage: Choose Status Bar
    Dots** is now one checklist that writes the same setting.
- With `agentUsage.isAgentNameShown` off, each agent shows only its icon (D15).
- Reads run every 60 s by default (D16). The popup is built from the last reading and never reads by itself.
- Release VSIX files are kept in `dist/`, one per version, and pushed with the source.
- Owed:
  - your look at 0.4.1 (V1);
  - P2's renewal half;
  - the Windows run (V2).
- The old extension stays installed until then (D8).

AgentUsage shows how much of each coding agent's usage limits is spent: Claude Code, Codex, Grok and Antigravity
(`agy`). One status bar item carries at most four traffic-light dots. Until the user checks dots on AgentUsage's
settings page, they are placed automatically and shared fairly between the connected agents:
- With one agent, that agent shows its windows (Claude: 5h, Weekly, Fable).
- With two agents, each gets two dots.
- With four agents, each gets one.
- A dot left over goes to the first agent, Claude by default.

Once the user checks dots, exactly those show, so the user decides, for example, that Codex shows Weekly and Grok shows
nothing. Clicking any dot opens a popup at once with every connected agent; it is VS Code's own hover for the
item, which resting the mouse also opens, after VS Code's delay. It shows:
- each window with its bar, percentage and reset time;
- when the agent was last read, and why a read failed;
- links to refresh, the settings page, the dot checklist and the log.

It replaces `claude-codex-usage-keychain` 0.2.4, the user's fork of `ypdev.claude-codex-usage` 0.2.2 (MIT).

**Why.** Upstream ships only its compiled `out/` folder, with no source maps and no repository, and the fork edited that
compiled JavaScript in place. Further work needs source the user owns. The fork also reads only Claude and Codex. With
all four agents, today's windows make ten dots (Claude 3, Codex 2, Grok 1, Antigravity 4), against the four the status
bar has room for. The user's screenshot read `Claude 🟢 5h 3% · 🟢 Weekly 75% · 🟢 Fable 2%`. The API at 20:29 answered
4 / 75 / 2, so polling works, and the gap is one poll. A stalled poll would look the same, though: a failed read keeps
the last numbers and marks nothing in the status bar, because only an expired token adds `$(warning)`.

**The user's rulings:**
- **The fork becomes AgentUsage**, and its code is the user's own from here on (2026-11-17): "the code never update,
  and that's why i want to fork".
- **Four agents: Grok CLI, Claude Code CLI, agy CLI, Codex CLI** (2026-11-17).
- **The user chooses which dots the status bar shows** (2026-11-17).
- **The hover lists every connected agent and its usage** (2026-11-17).
- **A plan comes first, in mvu-helper's plan style** (2026-11-17).
- **D1 — Claude's default dots are 5h, Weekly, Fable** (2026-11-17).
- **D2 — at most four dots, shared between the connected agents** (2026-11-17): "When we have 2 agents, user will have
  to choose 5h, weekly, fable(claude only) for each of the agent. So, when 4 agents all connected, each dot for each
  agent. the dot choose amoung 5h, weekly. hover any of the dot show popup menu to show the listing of detail usage for
  each agent." So it is one status bar item, and hovering any part of it opens the listing.
- **D3 — one colour rule for every dot: 🟢 below 80%, 🟡 80–94%, 🔴 from 95%** (2026-11-17).
- **D4 — both upstream fallbacks are dropped** (2026-11-17): Claude's `seven_day_opus` / `seven_day_sonnet`, and Codex's
  slot-position guess.
- **D5 — no migration; only `agentUsage.*` settings exist** (2026-11-17). Credentials are read where each CLI keeps them
  now, per platform: "claude code on Mac now read at a difference place. Windows on the other hand is on another
  location". What was measured is in §1.
- **D6 — English only** (2026-11-17).
- **D7 — VS Code's own hover** (2026-11-17).
- **D8 — the old extension stays installed until AgentUsage is complete** (2026-11-17).
- **D9 — Grok's token is read, never renewed; once it has expired, the hover says to run `grok`** (2026-11-17): "read
  the token, don't renew it. just show run grok to fresh token. you can try grok agent stdio and see if it renews
  token WITHOUT breaking login".
  - **Why**: auth.x.ai rotates refresh tokens, and renewing from outside has broken logins elsewhere (§1, Appendix A).
  - **The trial**: `grok agent stdio` is adopted only if P2 shows it renews an expired token and `grok` still signs in
    afterwards.
- **D10 — a spare dot goes to Claude by default, and the user can replace it with any other dot** (2026-11-17).
- **D11 — Antigravity gets four separate dots, one per window of its two model groups** (2026-11-17): "agy also show
  sonnet/opus, so it has to be 4 dots then."
- **D12 — Claude's token is read where Claude Code itself reads it, on each OS** (2026-11-17): "follow what claude
  does".
  - The environment token comes first.
  - On macOS: the keychain, then `.credentials.json` only when the keychain has no item.
  - On Windows, when Claude Code's rollout flag or env var is on: Credential Manager, then the file only when
    Credential Manager holds nothing. Without them: the file.
  - What was measured is in §1.
- **D13 — Codex is read through `codex app-server` on every platform; AgentUsage handles no Codex token** (2026-11-17).
- **D14 — the hover links to AgentUsage's settings page, where the dots are chosen** (2026-11-17): "we need to add
  setting in the popup screen. so that we can change which dot to show", then "add a setting link in the popup screen
  so that it will bring us to a setting page".
- **D15 — an option hides the agents' names** (2026-11-17): "need option to hide agent name "Claude", "Codex"...etc so
  that the bar is not as long".
- **D16 — the hover shows kept readings, refreshed every minute** (2026-11-17): "I believe it try to get the realtime
  stat when mouse over? Lets cache it and run the check every 1 min." The hover never read (§4). The minute is the new
  default interval (§6).
- **D17 — a click on the status bar item opens the popup at once** (2026-11-17): "i think i can speed it up by when you
  clicking on any dot, it will popup the window?", then "hover no longer needed if clickign on it will have fast
  popup". The popup is the item's own hover, opened without the delay (§4). Waiting on the hover is no longer needed.
- **D18 — clicking a link in the popup closes the popup** (2026-11-17): "clicking on the link like settings should
  close the popup".
- **D19 — AgentUsage has its own icon, for more agents than upstream's two** (2026-11-17): "make another one that
  represent our own logo that support more agents, perhaps the meter have 4 lines in different color".

**Decisions owed:** none.

---

## Tracking

| # | Item | State | Verified by |
|---|---|---|---|
| C1 | Copy of the installed fork 0.2.4 into this folder, without `.vsixmanifest` and VS Code's `__metadata`; the readme's Claude credential line corrected | built | `diff -rq` against the installed folder: only `.vsixmanifest` is missing; `package.json` parses; the modules that need no `vscode` load in node; a sample Claude response renders `🟢 5h 31% · 🟢 Weekly 0%` |
| P1 | Probe: `codex -s read-only -a never app-server` (the handshake, the `account/rateLimits/read` answer, the time per read) | done | live 2026-11-17 21:32: answered in 1.2 s after a 2.4 s `initialize`, 3.6 s in all; Codex exited by itself when stdin closed. Codex renewed its own expired token (`last_refresh` moved to 21:32, and the new token expires 2026-11-27). The answer is recorded in §1 and kept as the test fixture |
| P2 | Trial: `grok agent stdio` with ACP `_x.ai/billing` (D9). The protocol and the answer, then, after the token expires at 02:33 UTC, whether one run renews it and `grok` still signs in afterwards | protocol done; renewal owed | the protocol, live 21:33: `initialize` 26 ms, `_x.ai/billing` 215 ms, 0.9 s in all, exited by itself; `auth.json` was untouched (its token still valid). The renewal needs three things: a new `expires_at` in `auth.json`; the billing endpoint answering with the new token; and a later `grok` session starting with no sign-in prompt. It is adopted only if all three hold. To rerun after 02:33 UTC: `node tools/cli-login-times.js grok`, `node tools/cli-rpc-probe.js grok`, `node tools/cli-login-times.js grok` |
| S1 | Dev layout (§8): `src/index.js`, `src/vscode/`, `src/macos/`, `src/windows/`, `src/shared/`, `src/features/<feature>/`; plain CommonJS with no compiler boilerplate; `out/`, `FORK.md`, `changelog.md`, `l10n/` and `package.nls*.json` removed | built | `module-boundaries.test.js` (§11) passes; `grep -rn "__importStar\|sourceMappingURL" src/` finds nothing |
| S2 | Logger: `src/shared/log.js` with mvu-helper's `createModuleLog` API, the `AgentUsage` output channel as its sink, `agentUsage.logVerbosity`; every `catch` logs (§9) | built | `log.test.js` (gating per level, source tags, sink swap); `module-boundaries.test.js`: `console.` only in `shared/log.js`, and every `catch` logs, answers a failure or is marked `EXPECTED:`; `shared.test.js`: unparseable credentials text never reaches the log |
| S3 | Identity `kritblade.agent-usage` 0.4.1, display name AgentUsage, its own icon (D19), `main: ./src/index.js`, the commands and settings of §7 | built | `python3 tools/build-icon.py` wrote the SVG and the 256 px PNG from one geometry; Quick Look's render of the SVG matched the PNG. `vsce package` built `dist/agent-usage-0.4.1.vsix` (36 files, 59.2 KB, no `plans/`, `tests/`, `tools/`, `.vscode-test/`, upstream's `icon.png` or the SVG); `code --list-extensions` shows `kritblade.agent-usage@0.4.1`; `settings.test.js`: the five commands match between `package.json` and `src/index.js`, and every declared setting is read |
| A1 | Claude reader: the env token, then the store Claude Code itself uses on the OS (D12, §1); `five_hour`, `seven_day`, `limits[]` | built; macOS verified live | `claude-usage-core.test.js` on the 2026-11-17 answer, the service name, the keychain account and the rollout check; live 21:51 through `tools/read-agent-usage.js` from the keychain: 5h 27%, Weekly 78%, Fable 2%, plan `max · default_claude_max_5x`, 390 ms. The Windows path waits on V2 |
| A2 | Codex reader per D13: `codex -s read-only -a never app-server`, method `account/rateLimits/read`; windows classified by length only (D4) | built; verified live | `codex-usage-core.test.js` on the P1 answer (a weekly window in the primary slot, a window without a length dropped); live 21:51: 5h 11%, Weekly 40%, plan `plus`, 3 free resets, 608 ms; Codex exits by itself |
| A3 | Grok reader: `auth.json` in `GROK_HOME` and the `billing?format=credits` endpoint (§1); the token is used only while unexpired and never renewed (D9) | built; verified live | `grok-usage-core.test.js` on the 2026-11-17 answer (an expired session is refused without a request; the product split becomes the breakdown); live 21:51: Weekly 16% (GrokChat 13%, GrokBuild 3%), 314 ms; the `grok agent stdio` trial is P2 |
| A4 | Antigravity reader: `agy -p /quota --output-format json --log-file <null device>` (§1) | built; verified live | `antigravity-usage-core.test.js` on the 2026-11-17 output; live 21:51: Gemini 5h 8%, Gemini Weekly 2%, Claude and GPT 5h 0%, Claude and GPT Weekly 0%, 3.2 s; the agy log folder held 5 files before and after |
| H1 | Windows Credential Manager read (`src/windows/credential-manager.js`): PowerShell calling `CredReadW` for `Claude Code-credentials/claude-code-user`, decoded as UTF-8, with the `#0…#n` / `#m` chunks joined (D12) | built; unverified | `claude-usage-core.test.js`: the chunk joining, the target name and the rollout check; the PowerShell side waits on V2 (`cmdkey /list` shows the entry, and Claude's dots on Windows match `/usage` in `claude`) |
| U1 | Window model: every reader answers `{ windows[], plan?, notes?, fetchedAt }` (§2) | built | the four core tests check each window's `id` and `label` against the §2 table |
| U2 | Polling: a read per agent every 60 s by default (D16), §6's backoff, one read per agent at a time, a re-read after a reset passes, and a redraw as each agent lands (§6) | built | `usage-polling-core.test.js` (both backoff sequences, a longer retry-after, a forced read never cutting a rate-limit wait, a reset passed only after the reading and the 60 s guard); `settings.test.js` reads the 60 s default with no warning; V1 owes the look at Claude and Grok drawing before agy |
| U3 | Status bar: at most `agentUsage.maxStatusBarDots` dots, either the checked ones or, with none checked, automatic placement (§3); the names left out with `agentUsage.isAgentNameShown` off (D15); `$(warning)` beside an agent whose last read failed | built | `usage-display-core.test.js`, with the real agent descriptors: every row of §3's automatic table, limits of 1 and 8, a window outside the order, §3's checked example, the limit cutting checked dots, a checked window without a reading, names hidden, a failed agent, nothing connected. Live at 22:24 from this Mac's readings with names off: `$(sparkle) 🟢 5h 56% \| $(hubot) 🟢 5h 12% \| $(zap) 🟢 Weekly 16% \| $(rocket) 🟢 Gemini 5h 8%`. V1 owes the look |
| U4 | Choosing dots: the checkbox setting `agentUsage.statusBarDots` on the settings page (D14), and AgentUsage: Choose Status Bar Dots as one checklist that writes it (§5) | built | `settings.test.js`: checked boxes read as keys; saving none removes the setting; the ten checkboxes are exactly the agents' automatic-order windows, with `additionalProperties: false`. VS Code 1.146's settings page draws such an object as a checkbox list, one row per declared property. `dot-choice.test.js`: the bar's dots come checked; a change is saved; unchanged automatic placement saves nothing; none checked saves none; a checked window without a reading is kept; Escape; more than the limit, with its notice; the notice with no reading. V1 owes: the Settings link opens the page, and checking three boxes shows exactly those three |
| U5 | Popup: one table per agent with a reading or a failed read, the Not connected and Reading lines, four links: Refresh, Settings, Status bar dots, Log (§4); built at each redraw, never on opening (D16); opened at once by a click (D17); closed by any of its links (D18) | built; verified live | `usage-display-core.test.js` checks the markdown (tables, the empty Resets cell, the breakdown, notes, each failure line, the four links in order); `extension-activation.test.js`: the click command is `agentUsage.showUsagePopup` (hidden from the Command Palette) and runs `workbench.action.showHover`; each of the four links hides and shows the item before it acts. `node tools/popup-check.js`, live in an isolated VS Code 1.146 with real mouse events: the click opened it in 23–50 ms against 1528–1539 ms for a resting mouse; a click elsewhere closed it; its Settings link closed it and opened the page filtered to `@ext:kritblade.agent-usage` with ten checkboxes; the item kept its neighbours (`status.notifications`, `chat.statusBarEntry`). V1 owes your look |
| T1 | Tests run with `npm test` (`node --test "tests/*.test.js"`); no `vscode` needed | built | 82 pass. `node tools/mutation-check.js` breaks 29 rules one at a time, and each one fails a test. The new rules: the click opening the popup, its command hidden from the palette, a popup link closing the popup, closing dropping the entry, the checked filter, the checked limit, the checked-or-automatic switch, the fair share, names hidden, the Settings link, the No reading now group, unchanged automatic placement saving nothing, checked keys listed, the over-limit notice, saving none removing the setting, only true checkboxes counting, the settings page filter, the 60 s default, Codex's automatic order. The unchanged rules: the 80% colour, not connected being no failure, the backoff doubling, a forced read never cutting a rate limit, Grok's expiry check, agy's `remaining_fraction` inversion, the keychain account rule, Codex's weekly-by-length, Claude's model windows, credentials text kept out of the log |
| M1 | README for AgentUsage: what it shows, where each number comes from on each platform, settings, the popup and the hover delay, the upstream MIT credit | built | every `agentUsage.*` key in the README exists in `package.json` and the reverse; the four command titles it names match `package.json` (the fifth, the click's, is hidden from the palette); the endpoints, the JSON-RPC method, agy's arguments and both credential names it quotes are found in `src/` |
| V1 | Live on this Mac: package with `vsce`, install, all four agents read; the old extension removed only when AgentUsage is complete (D8) | 0.4.1 installed; reload and your look owed | `code --list-extensions` shows `kritblade.agent-usage@0.4.1`, the only AgentUsage identity installed. The open window keeps its earlier copy until it reloads. `tools/popup-check.js` passed against this source in an isolated VS Code. Owed after **Developer: Reload Window**: the status bar text, the icon in the Extensions view, the click popup and its four links closing it, the settings page's checkbox list, the checklist, and names off |
| V2 | Live on your Windows machine: install the same VSIX, Claude read from Credential Manager or the file, Grok from its file, Codex and `agy` run | owed | live |

---

## 1. Where each number comes from

Probed live on 2026-11-17 on this Mac (VS Code 1.146, Claude Code 2.1.293, Codex 0.145.0, Grok 1.0.4, agy 1.5.10).
Codex was not read: its file token has expired. Windows was not probed.

| Agent | Request | Answer used |
|---|---|---|
| Claude Code | `GET https://api.anthropic.com/api/oauth/usage` with `Authorization: Bearer`, `anthropic-beta: oauth-2025-04-20` and upstream's `User-Agent: claude-code/2.1.90` | `five_hour` and `seven_day` (`utilization`, `resets_at`); `limits[]` items of `kind: weekly_scoped` (`percent`, `resets_at`, `scope.model.display_name`); `subscriptionType` and `rateLimitTier` from the credentials as the plan |
| Codex | the child process `codex -s read-only -a never app-server`, newline-delimited JSON-RPC: `initialize` (`clientInfo`), the notification `initialized`, then `account/rateLimits/read`; stdin is closed and Codex exits by itself (D13, P1) | `rateLimits.primary` and `rateLimits.secondary` (`usedPercent`, `windowDurationMins`, `resetsAt` in epoch seconds); `rateLimits.planType`; `rateLimitResetCredits.availableCount` |
| Grok | `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with Bearer `key` and `X-XAI-Token-Auth: xai-grok-cli` (the headers Grok's README gives for using `auth.json` against its proxy) | `config.currentPeriod` (`type: USAGE_PERIOD_TYPE_WEEKLY`, `end`); `config.creditUsagePercent`; `config.productUsage[]` (`product`, `usagePercent`) |
| Antigravity | the child process `agy -p /quota --output-format json --log-file <null device>`, killed after 60 s | `status` (`"SUCCESS"`); `command.data.groups[]` (`name`), each with `buckets[]` (`id`, `window` `5h` or `weekly`, `remaining_fraction`, `reset_time`) |

**Credentials, by platform:**

| Agent | macOS | Windows |
|---|---|---|
| Claude Code | `CLAUDE_CODE_OAUTH_TOKEN`; else the keychain item `Claude Code-credentials` for account `<OS user>` (a non-default config dir adds `-` and the first 8 hex of its SHA-256); only when the keychain has no item, `.credentials.json` in the config dir (`CLAUDE_SECURESTORAGE_CONFIG_DIR`, then `CLAUDE_CONFIG_DIR`, default `~/.claude`) (D12) | `CLAUDE_CODE_OAUTH_TOKEN`; else, when `CLAUDE_CODE_FORCE_WINDOWS_CREDMAN=1` or `~/.claude.json` has `cachedGrowthBookFeatures.tengu_windows_credman: true`, the Windows Credential Manager entry `Claude Code-credentials/claude-code-user`, then the file when that holds nothing; otherwise `%USERPROFILE%\.claude\.credentials.json` (D12) |
| Codex | none under D13: Codex reads its own store (`auth.json` by default; the keychain item `Codex Auth` with `keyring`) | none under D13: Codex reads its own store (by default the age-encrypted `%CODEX_HOME%\secrets\codex_auth.age`) |
| Grok | `auth.json` in `GROK_HOME` (default `~/.grok`): the entry keyed `<issuer>::<id>` whose `key` is a string, with `expires_at`; when several exist, the latest expiry | `%USERPROFILE%\.grok\auth.json`, the same entry rule |
| Antigravity | none: agy signs itself in; `agy` must be on VS Code's `PATH` | the same, with the null device `NUL` |

**Measured:**
- **Claude**:
  - At 20:29 the API answered `five_hour` 4.0 and `seven_day` 75.0. Its `limits[]` held `session` 4 (`normal`),
    `weekly_all` 75 (`warning`, `is_active`) and `weekly_scoped` Fable 2 (`normal`).
  - The same answer came with the agent string `claude-code/2.1.90` and with `2.1.326`.
  - Claude Code 2.1.293 names five storage modes: `keychain`, `keychain-with-plaintext-fallback`, `windows-credman`,
    `windows-credman-with-plaintext-fallback` and `plaintext`. Linux uses `secret-tool`.
  - Its macOS store is `M(keychain, plaintext)`. Its `read` calls `security find-generic-password -a "<user>" -w -s
    "<service>"` and opens the file only when that returns nothing. The changelog line reads: "Fixed macOS sessions
    still showing "Not logged in" … when a leftover `~/.claude/.credentials.json` exists".
  - Its Windows check is `CLAUDE_CODE_FORCE_WINDOWS_CREDMAN === "1"`, or `cachedGrowthBookFeatures.tengu_windows_credman
    === true` in `<config dir>/.config.json` when that exists, else in `~/.claude.json`. A plaintext write prints
    "Warning: Storing credentials in plaintext."
  - On this Mac there is no `.credentials.json`. The keychain item (account: the macOS user name) trusts `/usr/bin/security`, so
    reading it raises no prompt, and it held a token valid until 03:48 UTC.
  - Bun builds each platform separately: the macOS build fixes its store to `"keychain"`, and the Windows Credential
    Manager code is not in it.
  - **Windows**, from the research in 2.1.326's win32 build (Appendix A):
    - With the flag on, the store is `windows-credman-with-plaintext-fallback`: Credential Manager first, then the
      file. The file is deleted after the first successful Credential Manager write.
    - The entry is a Generic credential named `Claude Code-credentials/claude-code-user`; a non-default config dir adds
      the `-<8 hex>` suffix to the first part. It is written through `Bun.secrets` as UTF-8 JSON.
    - A blob over 2400 bytes is split into base64 chunks `#0…#n`, with an `#m` entry holding `{"n","l"}`.
    - Claude Code's docs still name only `%USERPROFILE%\.claude\.credentials.json`.
- **Codex**:
  - `~/.codex/auth.json` was last refreshed on 2026-09-12, and its access token expired on 2026-09-22. `history.jsonl`
    also stops on 2026-09-12, so the token expired because Codex has not run since, not because the token moved.
  - Codex 0.145.0 can keep its login elsewhere: `cli_auth_credentials_store` is `file` (the default), `keyring`, `auto`
    or `ephemeral`. This Mac uses the file. With `keyring` the login sits in the macOS keychain (`Codex Auth`, account
    `cli|<16 hex>`).
  - On Windows, Codex's secret storage is on by default: the login is age-encrypted in
    `%CODEX_HOME%\secrets\codex_auth.age`, with the passphrase in Credential Manager. So `auth.json` holds nothing
    there.
  - `codex -s read-only -a never app-server` answers the JSON-RPC method `account/rateLimits/read` from whichever
    store Codex uses, and Codex renews its own token (D13). CodexBar and agent-limits-vscode use it when reading
    `auth.json` fails.
  - **P1, at 21:32**: `primary` 10% (`windowDurationMins` 300), `secondary` 39% (10080), `planType` `plus`,
    `credits.balance` "0", and 3 free rate-limit resets available.
    - Timing: `initialize` 2.4 s, the read 1.2 s, 3.6 s in all.
    - The expired token was renewed by Codex itself, from 2026-09-22 to 2026-11-27.
    - `rateLimitsByLimitId` holds the same snapshot under `codex`.
- **Grok**:
  - Its CLI is 1.0.4, the official one from `x.ai/cli`. The endpoint comes from the binary's strings
    (`/billing?format=credits`, "Billing data requires auth with grok.com"). It 404s at the proxy root and answers
    under `/v1`.
  - The answer read: a weekly period from 2026-11-11 15:51 to 2026-11-18 15:51 UTC, 16% of credits used, GrokChat 13%
    and GrokBuild 3%. The two products add up to the 16%, so they are shares of one pool, not separate limits (§2).
  - The stored token had expired on 2026-08-23. Running `grok` renewed it: the new one was created at 20:33 and
    expires at 02:33 UTC, so it lives 6 hours, and only the CLI renews it (D9).
  - auth.x.ai rotates refresh tokens. xAI's own client code says a used refresh token is accepted again for only about
    60 s, after which reuse "trips the IdP's reuse detection and revokes a successor".
  - OpenChamber renewed Grok's token in memory, and the next morning `grok` failed with `invalid_grant`.
  - `grok` guards its own renewals with a lock on `~/.grok/auth.json.lock`, which Node cannot join without a native
    module (Appendix A).
  - Grok's headless mode has no read-only `/usage` answer like agy's: a `-p` prompt runs the model. Its ACP mode
    (`grok agent stdio`) has the method `_x.ai/billing`, which CodexBar uses (D9).
  - CodexBar, ClaudeBar and Raycast's Agent Usage call the same billing endpoint (Appendix A). The CLI itself also
    sends `x-userid` and `x-grok-client-version`, and ClaudeBar sends `x-grok-client-mode: build`. The two headers
    used here were enough.
  - The binary reads `GROK_HOME`, `USERPROFILE` and `APPDATA`.
  - **P2, at 21:33**: `grok agent stdio` answers ACP `initialize` (`protocolVersion` 1, `authMethods` `cached_token`
    and `grok.com`, `agentVersion` 1.0.88). `_x.ai/billing` then gives the same credits as the REST call, plus
    `subscription_tier: "SuperGrok"`, but no product split.
  - In Grok's source, the billing handler takes `current_or_expired()`, so it never renews. The start-up sign-in step
    (`run_auth_flow_steps`) does renew an expired token, under the `auth.json` lock, and writes it back. Whether
    `agent stdio` runs that step when it starts is what P2's renewal half shows.
- **Antigravity**:
  - agy 1.5.10's own changelog says print mode answers `/usage`, `/quota` and `/credits` without the model.
    Measured: 0 tokens, about 3 s per read.
  - The answer has two groups, Gemini Models and "Claude and GPT models", each with a 5-hour and a weekly bucket:
    Gemini 92% and 98% remaining, the other group 100% and 100%.
  - Each run writes a new log file under `~/.gemini/antigravity-cli/log/`; with `--log-file /dev/null` it writes none.
    The prompt history (`history.jsonl`) is not touched. `/credits` read `Remaining credits 0`, which is not used.
  - VS Code's extension host has `~/.local/bin` on its `PATH`, so `agy` resolves.
- **Not usable**:
  - agy's hub started by VS Code (`agy --hub`, its ports in `~/.gemini/antigravity/daemon/hub_*.json`) logs "You are
    not logged into Antigravity" every minute, so its local `GetUserStatus` has no quota to give.
  - Calling Google's `cloudcode-pa …/v1internal:fetchAvailableModels` with agy's keychain token while presenting agy's
    client identity was refused by this session's safety check as unauthorized access. It is out of this plan (§12).

**How each read can fail:**

| Outcome | Reason | Effect |
|---|---|---|
| no credential in any store, Grok has no session, `agy` not found | not connected | listed under Not connected in the popup; no dot |
| HTTP 401 or 403; Grok `expires_at` already past (then no request is sent) | token expired | the last numbers stay; `$(warning)`; the popup says to run the CLI once |
| HTTP 429 | rate-limited | backoff (§6) honouring `retry-after`; `$(warning)` |
| network error, timeout, any other status, unreadable JSON, agy exit ≠ 0 or `status` ≠ `SUCCESS` | error | backoff (§6); `$(warning)`; the popup shows the detail, for agy in its own words |

## 2. The window model

Every reader answers one shape, so the poller and the display never know which agent they hold.

- **`UsageWindow`**: `id` (stable within the agent), `label`, `usedPercent` (0–100), and optionally `resetsAt`, which is
  absent when the provider sends none: an unused window arrives with `resets_at: null`, and the fork's 0.2.4 fix
  carries over. Also optionally `breakdown` (`[{ label, usedPercent }]`), shown in the popup only.
- **`UsageSnapshot`**: `agentId`, `windows` in display order, `plan?`, `notes?` (extra hover lines, such as Codex's
  free rate-limit resets), `fetchedAt`.
- **`UsageResult`**: `{ isOk: true, snapshot }`, or `{ isOk: false, reason, detail?, retryAfterMs? }` with a reason
  from §1's table.

| Agent | Window `id` | Label | From |
|---|---|---|---|
| claude | `session` | `5h` | `five_hour` |
| claude | `weekly` | `Weekly` | `seven_day` |
| claude | `weekly:<model>` | the model name, e.g. `Fable` | `limits[]`, `kind: weekly_scoped` |
| codex | `session` | `<n>h` from `windowDurationMins` (today 300, so `5h`) | `primary` or `secondary`, whichever is shorter than 2 days |
| codex | `weekly` | `Weekly` | the one of 2 days or more (today 10080); a window without `windowDurationMins` is dropped with a warning (D4) |
| grok | `credits` | `Weekly` or `Monthly`, by `currentPeriod.type` | `creditUsagePercent`, reset at `currentPeriod.end`; `productUsage[]` as the breakdown |
| antigravity | the bucket's `id`: `gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly` | the group name without "models" plus the window: `Gemini 5h`, `Claude and GPT Weekly` | `100 × (1 − remaining_fraction)`, reset at `reset_time`; within each group 5h comes before weekly |

## 3. The status bar

There is one item on the right, and clicking any dot opens §4's popup. Which windows get dots depends on
`agentUsage.statusBarDots` (§5):
- **Some dots checked**: exactly the checked windows that have a reading show, up to `agentUsage.maxStatusBarDots`.
  They are ordered by agent (`agentUsage.agents`), then by each reading's window order. A checked window with no
  reading is skipped and comes back with its agent.
- **None checked: automatic placement**, in three steps:
  1. **Who**: the agents in `agentUsage.agents` order (default Claude, Codex, Grok, Antigravity) that have a reading.
  2. **Fair share**: with `n` such agents and the limit (4), each agent shows the first ⌊4 ÷ n⌋ windows of its
     automatic order that its reading has. An agent with fewer windows shows fewer.
  3. **Left over**: the places still free go to the first agent's next windows in its order, then to the next agent's
     (D10: Claude by default).

| Agent | Automatic order (each agent descriptor's `automaticDotOrder`) |
|---|---|
| claude | `session`, `weekly`, `weekly:Fable` (D1) |
| codex | `session`, `weekly` |
| grok | `credits` |
| antigravity | `gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly` (D11) |

A window outside its agent's order, such as a new Claude model, shows in the popup and can be checked. Automatic
placement never picks it.

| Connected | Fair share | Automatic dots |
|---|---|---|
| Claude | 4 | Claude 5h, Weekly, Fable |
| Claude, Codex | 2 | Claude 5h, Weekly · Codex 5h, Weekly |
| Claude, Grok | 2 | Claude 5h, Weekly · Grok Weekly · left over: Claude Fable |
| Claude, Codex, Grok | 1 | Claude 5h · Codex 5h · Grok Weekly · left over: Claude Weekly |
| Codex, Grok, Antigravity | 1 | Codex 5h · Grok Weekly · Antigravity Gemini 5h · left over: Codex Weekly (Claude is absent, so the first agent) |
| all four | 1 | Claude 5h · Codex 5h · Grok Weekly · Antigravity Gemini 5h |

**A checked example:** with `claude/session`, `claude/weekly` and `codex/weekly` checked and all four agents connected,
the status bar shows Claude 5h and Weekly, then Codex Weekly. Grok and Antigravity get no dot, but both stay in the
hover.

````
$(sparkle) Claude 🟢 5h 4% | $(hubot) Codex 🟢 5h 12% | $(zap) Grok 🟢 Weekly 16% | $(rocket) Antigravity 🟢 Gemini 5h 8%
$(sparkle) 🟢 5h 4% | $(hubot) 🟢 5h 12% | $(zap) 🟢 Weekly 16% | $(rocket) 🟢 Gemini 5h 8%
````

- **Segment**: each agent is drawn as its icon and its name, then its dots. With `agentUsage.isAgentNameShown` off,
  the name is left out, as on the second line above (D15). A dot reads `<dot> <label> <rounded %>`.
- **Dot colour**: 🟢 below 80%, 🟡 80–94%, 🔴 from 95% (D3).
- **`$(warning)`** follows the agent's name, or its icon, when its last read failed. The numbers shown are still the
  last good ones.
- **Nothing to show**: `$(pulse) AgentUsage`, with `$(warning)` when an agent's last read failed.
- **Click**: opens §4's popup at once (D17). Refresh is the popup's first link.

## 4. The popup

This is VS Code's own hover for the item (D7): markdown with tables, codicons and command links (`isTrusted` limited to
AgentUsage's five commands). Each connected agent gets one block, whether or not it has a dot:

````
**$(sparkle) Claude Code** · max · default_claude_max_5x

| | Window | Used | Resets |
|:-:|:--|:--|:--|
| 🟢 | 5h | ▱▱▱▱▱▱▱▱▱▱ 4% | in 3h58m · 11/18(Wed) 00:29 |
| 🟢 | Weekly | ▰▰▰▰▰▰▰▰▱▱ 75% | in 12h28m · 11/18(Wed) 08:59 |
| 🟢 | Fable | ▱▱▱▱▱▱▱▱▱▱ 2% | in 12h28m · 11/18(Wed) 08:59 |

Updated 20:31 · 2m ago
````

- A window with no reset time leaves the Resets cell empty.
- A breakdown prints under its table: `GrokChat 13% · GrokBuild 3%`.
- A failed last read adds one line under "Updated", such as `⚠ The usage API answered 429; next try in 5m.`
- **Not connected**: one line names each enabled agent that has no credential, or whose CLI is missing, with what to
  run (`claude`, `codex`, `grok`, `agy`).
- **Footer**: `$(refresh) Refresh · $(gear) Settings · $(checklist) Status bar dots · $(output) Log`, each a command
  link. Settings opens VS Code's settings page filtered to `@ext:kritblade.agent-usage` (D14).
- **Built at each redraw, never on opening** (D16): the item holds the finished markdown, rebuilt when a read lands and
  every 30 s. Opening the popup reads nothing. An open popup is redrawn in place.
- **Opened two ways:**
  - **Click** (D17): the item's click command is `agentUsage.showUsagePopup`, which runs VS Code's
    `workbench.action.showHover`.
    - That command opens the hover of the focused element at once, and the click has just focused the item's label
      (`a.statusbar-item-label`, tabindex −1).
    - The popup takes the focus, so it stays open until a click elsewhere or Escape. The click that closes it still
      reaches what it lands on.
    - **A link closes it before acting** (D18). Each link's command first hides the item and shows it again: VS Code
      drops an entry's hover with the entry, and `hide()` removes the entry at once while `show()` adds it back on the
      next tick. Extension entries are ordered by priority and then by a hash of the extension id, so the item returns
      between the same neighbours. No other route works: VS Code has no command that closes a workbench hover, and
      emptying the tooltip closes it only until the next redraw opens it again.
    - The command is hidden from the Command Palette, where no AgentUsage element would be focused.
  - **Resting the mouse**: VS Code waits `workbench.hover.delay`, 1500 ms on macOS and 500 ms elsewhere.
- **Measured** by `node tools/popup-check.js`: an isolated VS Code 1.146 (its own profile, this extension from source),
  driven with real mouse events through its DevTools port:
  - a click opened the popup in 23–50 ms; resting the mouse opened it in about 1540 ms;
  - a click elsewhere closed it;
  - the Settings link closed it and opened the settings page filtered to `@ext:kritblade.agent-usage`, with the ten
    checkboxes;
  - the item kept its neighbours on both sides.

## 5. Choosing the dots

The choice lives in `agentUsage.statusBarDots`, in the user settings, and two places write it:
- **The settings page** (D14): the popup's **Settings** link, or **AgentUsage: Open Settings**.
  - `agentUsage.statusBarDots` shows one checkbox for each of the ten windows in §2's table, named
    `<agent>/<window id>`.
  - Hovering a name gives its window, e.g. "Claude Code: 5h (the current session)".
- **AgentUsage: Choose Status Bar Dots**: the popup's **Status bar dots** link.
  - One checklist of every window that has a reading, grouped by agent: `<dot> <label> — <percent> · resets in
    <time>`.
  - The dots now on the status bar come checked.
  - Checked windows that have no reading are listed under "No reading now", so they stay checked unless unchecked.
  - Accepting saves the checked ones. Escape changes nothing.

How the choice applies:
- **None checked** is automatic placement (§3). Unchecking every box, or accepting the checklist with none checked,
  goes back to it. Saving none removes the setting.
- **Accepting the checklist unchanged while placement is automatic** saves nothing, so placement stays automatic.
- **More checked than `agentUsage.maxStatusBarDots`**: the first ones in status bar order show. The checklist says so
  when it saves.
- **A checked window whose reading is missing** is skipped and stays checked, so it returns with its agent.
- **A window outside the ten**, such as a new Claude model, can be checked from the checklist. settings.json then
  marks its key as not allowed, and the dot shows anyway.

## 6. Polling

- Every `agentUsage.refreshIntervalSeconds` (default 60, minimum 30), each enabled agent is read (D16).
- **Each VS Code window reads on its own.** With three windows open, each provider is read three times a minute.
- **One read per agent at a time.** agy takes about 3 s and an HTTP read can take up to 15 s, so a slow read is never
  doubled.
- **Backoff:**
  - A rate-limited read waits 5 minutes, doubling up to 60.
  - An error waits 2 minutes, doubling up to 60.
  - The server's `retry-after` wins when it is longer.
  - A forced read (activation, the Refresh command, a settings change) never cuts a rate-limit wait.
- **Every 30 s**: a redraw keeps the relative times current. An agent is read again when one of its windows' reset
  time has passed and its reading is more than 60 s old.
- **Each agent's result redraws as it lands**, so Claude and Grok never wait for agy.
- **Settings changes:**
  - A change to `agents`, `refreshIntervalSeconds`, `codexCommand` or `antigravityCommand` restarts the timer and
    reads now.
  - A change to `statusBarDots`, `maxStatusBarDots` or `isAgentNameShown` only redraws.
  - A change to `logVerbosity` takes effect at once.

## 7. Settings, commands, identity

The settings page lists them in this order (each setting's `order`):

| Setting | Default | Meaning |
|---|---|---|
| `agentUsage.statusBarDots` | `{}`, none checked | the dots to show, one checkbox per window; none checked is automatic placement (§3, §5) |
| `agentUsage.maxStatusBarDots` | `4` (1–8) | most dots the status bar shows |
| `agentUsage.isAgentNameShown` | `true` | each agent's name beside its icon on the status bar; off leaves the icons only (D15) |
| `agentUsage.agents` | `["claude", "codex", "grok", "antigravity"]` | agents to read, in status bar order; the first one takes the dots left over in automatic placement |
| `agentUsage.refreshIntervalSeconds` | `60` (minimum 30) | polling interval (D16) |
| `agentUsage.codexCommand` | `codex` | the command run for Codex (`<command> -s read-only -a never app-server`), found on VS Code's `PATH` |
| `agentUsage.antigravityCommand` | `agy` | the command run for Antigravity, found on VS Code's `PATH` |
| `agentUsage.logVerbosity` | `off` | `off`, `lifecycle`, `verbose` or `trace`; errors and warnings always log |

| Command | Title |
|---|---|
| `agentUsage.showUsagePopup` | AgentUsage: Show Usage Popup: the item's click; hidden from the Command Palette (§4) |
| `agentUsage.refresh` | AgentUsage: Refresh |
| `agentUsage.openSettings` | AgentUsage: Open Settings |
| `agentUsage.chooseStatusBarDots` | AgentUsage: Choose Status Bar Dots |
| `agentUsage.showLog` | AgentUsage: Show Log |

**Identity**:
- `kritblade.agent-usage` 0.4.1, with display name AgentUsage. The new identity installs beside the old extension (D8).
- **Icon**: `images/agent-usage-icon.png` (256 px), drawn with `images/agent-usage-icon.svg` by
  `python3 tools/build-icon.py` (Pillow) from one geometry (D19). Each row is one agent's meter in status bar order, five
  segments each: Claude `#E07B53` (3 filled), Codex `#ECEEF2` (4), Grok `#A48BFA` (2), Antigravity `#4F8EF7` (3). No
  row is full, so the icon never reads as a limit hit. Upstream's `images/icon.png` stays in the folder, unshipped.
- `main: ./src/index.js`, activated on `onStartupFinished`, `engines.vscode ^1.85.0`.
- Plain JavaScript (CommonJS) with no build step: `src/` ships as it is.
- `npm test` runs `node --test "tests/*.test.js"`; Node expands the glob itself, so it works the same on Windows.
- `npm run package` runs `npx --yes @vscode/vsce@3 package --allow-missing-repository --out dist/`, which writes
  `dist/agent-usage-<version>.vsix`. `dist/` is tracked and keeps one VSIX per release; a build of an unchanged
  `version` replaces that version's file.
- `node tools/read-agent-usage.js` reads each agent once with the extension's readers, outside VS Code.
- `node tools/mutation-check.js` runs §11's mutants; `node tools/popup-check.js` runs §4's live check.
- `.vscodeignore` keeps `plans/`, `tests/`, `tools/`, `.context/`, `.github/`, `.vscode/`, `.vscode-test/`, `dist/`,
  built VSIX files, upstream's `images/icon.png` and the icon's SVG source out of the VSIX.

## 8. Files

````
AgentUsage/
├── plans/agent-usage.md
├── dist/                           release VSIX files, one per version; tracked, never shipped
├── tests/                          node --test; never shipped
├── tools/                          never shipped
│   ├── read-agent-usage.js         one read per agent with the extension's readers, outside VS Code
│   ├── cli-rpc-probe.js            the P1/P2 probe: a CLI's JSON-RPC handshake and one read, identities redacted
│   ├── cli-login-times.js          Codex's and Grok's stored login timestamps only, never a token
│   ├── mutation-check.js           breaks one rule at a time and reports any rule no test catches (T1)
│   ├── popup-check.js              §4's live check: an isolated VS Code driven with real mouse events
│   └── build-icon.py               draws images/agent-usage-icon.svg and .png from one geometry (§7)
├── images/                         agent-usage-icon.png (shipped), agent-usage-icon.svg, icon.png (upstream's, unshipped)
├── package.json  README.md  LICENSE.txt (upstream MIT, kept)  .vscodeignore
└── src/
    ├── index.js                    activate/deactivate: lists the agents, wires poller, display, settings, commands
    ├── vscode/                     the only folder that requires 'vscode'
    │   ├── log-channel.js          the "AgentUsage" log output channel as the log sink
    │   ├── settings.js             reads agentUsage.*, saves the checked dots, opens the settings page, reports changes
    │   ├── status-bar.js           the one item: text and markdown tooltip, opening it on a click, closing it
    │   ├── dot-picker.js           the checklist of §5 as a multi-select quick pick, and a notice
    │   └── commands.js             command registration
    ├── macos/
    │   └── keychain.js             /usr/bin/security find-generic-password; the secret is never logged
    ├── windows/
    │   └── credential-manager.js   PowerShell CredRead for one target; the secret is never logged
    ├── shared/
    │   ├── log.js                  createModuleLog, setLogSink, setLogVerbosity
    │   ├── usage-window.js         the §2 shapes as JSDoc; toUsedPercent, parseIsoResetTime
    │   ├── usage-http.js           GET with timeout; HTTP outcome → UsageResult; parseRetryAfterMs
    │   └── credentials-file.js     a CLI's JSON credentials file; missing → not connected
    └── features/
        ├── claude-usage/           index.js · claude-usage-core.js (pure) · claude-usage.js
        ├── codex-usage/            index.js · codex-usage-core.js · codex-usage.js
        ├── grok-usage/             index.js · grok-usage-core.js · grok-usage.js
        ├── antigravity-usage/      index.js · antigravity-usage-core.js · antigravity-usage.js
        ├── usage-polling/          index.js · usage-polling-core.js (backoff, reset check) · usage-polling.js (timers)
        └── usage-display/          index.js · usage-display-core.js (placing dots, status text, hover markdown, checklist
                                    entries) · dot-choice.js (the §5 checklist flow; editor calls passed in)
````

**Agents plug in, nothing imports them.** Each agent's barrel exports one descriptor:
`{ id, displayName, statusBarName, icon, cliCommand, automaticDotOrder, readUsage(environment) }`. `src/index.js` lists
the four descriptors and hands them to polling and display, which never import an agent feature (P5). Adding a fifth
agent takes one new feature folder, one line in `index.js`, and its windows' checkboxes in `package.json`.

**`shared/` is earned** (P3):
- `usage-window.js` serves all six features.
- `usage-http.js` serves Claude, Codex and Grok.
- `credentials-file.js` serves the same three.
- `log.js` serves every file.

The keychain and Credential Manager readers live in `src/macos/` and `src/windows/`, so the platform coupling shows in
the path (P4).

**Where the old code goes:**

| Old `out/src/` | New |
|---|---|
| `extension.js` | `src/index.js` (wiring) and `features/usage-polling/` (timers, backoff use, reset check) |
| `statusBar.js` | `src/vscode/status-bar.js` |
| `format.js` | `features/usage-display/usage-display-core.js` |
| `backoff.js` | `features/usage-polling/usage-polling-core.js` |
| `providers/claude.js` | `features/claude-usage/` and `src/macos/keychain.js` |
| `providers/codex.js` | `features/codex-usage/` |
| `providers/http.js` | `src/shared/usage-http.js` |
| `types.js` | `src/shared/usage-window.js` |
| `l10n.js`, `l10n/`, `package.nls*.json` | removed (D6) |
| `FORK.md`, `changelog.md` | removed. The facts still true move into the code they explain: the keychain lookup order into `claude-usage-core.js`, `resets_at: null` into `usage-window.js` |

## 9. Logging and errors

- Each file creates `createModuleLog('<source>')`, where the source is its feature folder or its host/shared file
  name. Lines read `[<source>] …` in the **AgentUsage** output channel.
- **Levels:**
  - `error` and `warn` always log.
  - `lifecycle`: activation and settings applied.
  - `verbose`: each read's outcome per agent.
  - `trace`: raw responses.
- No token and no request header is ever logged.
- **Every `catch` logs its context and the error.** There are three narrow exceptions:
  - **A missing credentials file, store entry or `agy`** is expected: the agent is simply not connected. It logs at
    `verbose` and is marked `// EXPECTED:`.
  - **A credentials blob that will not parse** logs the error's name only, because V8's message quotes the text it
    failed on, and that text holds the token.
  - **A failed `security` or PowerShell call** logs its exit code and signal only, because the error's message
    carries the child's stderr, which can echo item data.
- A reader returns failures as values. A reader that throws is a bug: the poller logs it with `error` and records an
  error result.
- `console.*` appears only in `shared/log.js`, as the sink used before activation.

## 10. Failure modes

| What happens | Result | Cost |
|---|---|---|
| a CLI is not installed or is signed out | under Not connected in the popup; no dot, and its turn passes to the next agent | none |
| a token expires | the last numbers stay, `$(warning)` beside the agent, and the popup says to run the CLI | numbers age until the CLI runs |
| `grok` has not run for 6 hours | Grok reads token expired without sending a request, and its token is never renewed (D9) | GrokChat spending on the web goes unseen until `grok` runs |
| a provider answers 429 | backoff of 5 to 60 minutes; `$(warning)`; the popup names the next try | numbers age |
| a network, HTTP or parse error | backoff of 2 to 60 minutes; `$(warning)`; the popup gives the detail | numbers age |
| PowerShell cannot read Credential Manager (policy, antivirus) | an error naming PowerShell's exit code. The file is not read in its place, because Claude Code reads the file only when Credential Manager holds nothing | Claude's numbers on Windows |
| `codex` is missing, or signed out | missing: Not connected, naming `agentUsage.codexCommand`; signed out: an error in Codex's own words | none |
| app-server's answer changes shape (it is Codex's own protocol) | error in the popup | Codex's numbers stop until the reader is updated |
| your Codex session and app-server both renew Codex's token at the same moment | unverified. Codex issue #9634 reports this race between runners on different machines; whether Codex guards against it on one machine is not known | at worst, `codex login` again |
| `agy` is not on VS Code's `PATH` | Not connected, naming `agentUsage.antigravityCommand` | none |
| `agy` hangs | killed at 60 s and recorded as an error | at most one agy process per agent read |
| agy is signed out | agy's own message in the popup. Its exact text is not yet seen, so it is not matched (no guessed mapping) | none |
| a provider adds or drops a window | the popup follows the answer; a checked window that vanished is skipped, and a new one can be checked from the checklist | none |
| many VS Code windows are open | each reads every agent each minute (§6), so Claude's usage endpoint may answer 429 | numbers age during the backoff |
| Grok moves its billing route (it is undocumented) | error `HTTP 404` in the popup | Grok's numbers stop until the route is updated |

## 11. Tests

All run under `npm test` (`node --test "tests/*.test.js"`), with no `vscode`.
- `claude-usage-core.test.js`:
  - the 2026-11-17 answer gives `session`, `weekly` and `weekly:Fable`; a `null` reset is kept as no reset; a wrong
    reset drops the window; the old per-model fields are not read (D4);
  - the service name for the default and a custom config dir; the keychain account rule; the environment token;
  - the rollout check and the Credential Manager target; the credentials blob's token and plan;
  - Credential Manager's chunks `#0…#n` and `#m` join into one blob.
- `codex-usage-core.test.js`, on P1's answer: windows by length (a weekly window in the primary slot reads as weekly);
  a window without a length is dropped; the session label from the length; an unreadable reset; the free-resets note.
- `grok-usage-core.test.js`: the 2026-11-17 billing answer gives `credits` at 16% with the product breakdown; the
  period type names the window; the session with the latest expiry is picked; the expiry check.
- `antigravity-usage-core.test.js`: the 2026-11-17 output gives four windows in §2's order (`Gemini 5h` at 8%, …); a
  non-JSON answer and `status` ≠ `SUCCESS` each give a problem in agy's words; a bucket without a fraction is dropped.
- `usage-polling-core.test.js`: both backoff sequences; a longer `retry-after`; a forced read never cutting a
  rate-limit wait; a reset that passed after the reading triggering a re-read only after 60 s.
- `usage-display-core.test.js`, with the real agent descriptors, so their automatic orders are what is tested:
  - automatic placement: every row of §3's table, limits of 1 and 8, a window outside the order left out;
  - checked dots: §3's checked example, the limit cutting in status bar order, a checked window without a reading;
  - the status text: the segments, names hidden, a failed agent, nothing to show;
  - the popup: the tables, the empty Resets cell, the breakdown, notes, each failure line, Not connected, Reading, the
    four links;
  - the checklist entries: grouped by agent, checked as given, and the "No reading now" group.
- `dot-choice.test.js`: the §5 checklist with a scripted picker (the status bar's dots come checked, a change saved,
  unchanged automatic placement saving nothing, none checked saving none, Escape, more than the limit, the notice
  with no reading).
- `settings.test.js`, against a stand-in for `vscode` that answers `package.json`'s declared defaults:
  - the defaults read back with no warning, and every declared setting is read;
  - checked dots read as their keys; a wrong value falls back to its default with a warning;
  - saving dots writes the checked keys, and saving none removes the setting; the settings page opens filtered to
    the extension;
  - the ten checkboxes are exactly the agents' automatic-order windows; the five commands match between
    `package.json` and `src/index.js`.
- `extension-activation.test.js`: `src/index.js` activated against a stand-in for `vscode` and four agents that read
  nothing:
  - the click runs `workbench.action.showHover`, and its command is hidden from the Command Palette (D17);
  - each popup link hides and shows the item, which closes the popup, before it acts (D18).
- `node tools/popup-check.js`, live: §4's measurement in an isolated VS Code; it opens a VS Code window for about
  half a minute.
- `log.test.js`: each level's gate; the source and sub-tags; error and object formatting.
- `shared.test.js`: `retry-after`, percentages, reset times, failures, and credentials text never reaching the log.
- `module-boundaries.test.js`:
  - only `src/vscode/` requires `vscode`; a feature reaches another only through its `index.js`;
  - `shared/` and the host folders never import a feature; every relative `require` names an existing `.js` file;
  - `console.` appears only in `shared/log.js`; every `catch` logs, answers a failure, or is marked `EXPECTED:`.
- `extension-load.test.js`: `src/index.js` and every module it requires load against an empty stand-in for `vscode`.
- **Mutants**: `node tools/mutation-check.js` breaks one rule at a time, restores the file, and reports any rule no
  test catches (T1 lists the 29).

## 12. Not in this plan

- **A bigger screen than the popup**: a webview panel.
- **Opening the popup sooner when the mouse rests on the item.** A click opens it at once (§4). The resting wait is
  out of the extension's reach:
  - VS Code shows a lazily built status bar tooltip after 500 ms, but that tooltip is `StatusBarItem.tooltip2`, the
    proposed API `statusBarItemTooltip`. VS Code 1.146 refuses it to extensions that are not on the allow-list in its
    `product.json`, which does not name it.
  - VS Code's own entries open their tooltip by click through `statusBar.entry.showTooltip`, matched by object
    identity, so an extension's command of that name is not recognised.
  - What remains is the user's own `workbench.hover.delay`.
- **One reading shared by every VS Code window** (a cache file in the extension's global storage): each window now
  reads on its own (§6). It is worth building if 429s appear with many windows open.
- **Google's internal quota API with agy's token.** It was refused by this session's safety check (§1). agy's own
  `/quota` answers instead.
- **Renewing any CLI's token.** Each CLI renews its own. A renewal from outside revoked the CLI's login for OpenChamber
  (Grok) and CodexBar (Claude, Codex) (D9, Appendix A).
- **A sign-in of AgentUsage's own** (OpenUsage's way): a second login for every agent (D9).
- **Linux secret storage.** Claude Code on Linux can use `secret-tool`. AgentUsage reads only the file there.
- **More agents** (Gemini CLI, Cursor, Copilot): the descriptor makes each one a feature folder, when you ask.
- **Grok's spend fields** (`onDemandCap`, `onDemandUsed`, `prepaidBalance`): their unit is not known yet, all read 0,
  and nothing shows them.
- **Publishing** to the VS Code Marketplace or Open VSX.

---

## Appendix A — how other tools read usage (researched 2026-11-17)

Approach letters:
- **a**: read the CLI's token and tell the user to run the CLI when it expires.
- **b**: renew the token and write it back to the CLI's store.
- **c**: renew it in memory only.
- **d**: run the CLI and let it answer.
- **e**: use browser cookies.
- **f**: the tool's own sign-in.

| Tool | Agent | Data source | Token handling |
|---|---|---|---|
| CodexBar (macOS menu bar) | Claude | `/api/oauth/usage`; then `claude` `/usage` in a terminal; then the claude.ai cookie | a, d, e. When the token has expired, a click runs `claude` `/status` so Claude Code renews its own keychain item |
| CodexBar | Codex | `wham/usage`; then `codex -s read-only -a never app-server`, method `account/rateLimits/read` | a, d. Since 0.50.1 the token is never renewed or written |
| CodexBar | Grok | `grok agent stdio`, ACP `_x.ai/billing`; then `/v1/billing?format=credits` with an unexpired token; then grok.com | a, d, e: "does not refresh tokens" |
| ClaudeBar | Claude, Codex, Grok | `claude /usage` in a terminal, `codex app-server`, the Grok billing endpoint | d by default. Its API modes are b, writing back without taking grok's lock |
| OpenUsage | all | its own sign-ins (xAI by device code) | f |
| OpenChamber (web and VS Code) | Grok | grok.com billing | was c, which broke the CLI's login; now a |
| agent-limits-vscode | Codex | `wham/usage`, then app-server | a, d |
| Raycast Agent Usage | Claude, Grok | OAuth usage; Grok billing | b for Claude; Grok's handling unverified |
| AFK Pilot (VS Code) | Grok | its own running grok ACP session | d |

**Sources:**
- **CodexBar**:
  - Grok provider: `github.com/steipete/CodexBar/blob/main/docs/grok.md`.
  - Codex token rationale: `Sources/CodexBarCore/Providers/Codex/CodexProviderDescriptor.swift`, which says
    "Redeeming a shared token without publishing the rotated response strands its owner"; the change is PR #2944.
  - Claude re-login issues: #1161 (fixed 0.32.1) and #2745 (0.49.0).
- **ClaudeBar**: `github.com/tddworks/ClaudeBar/blob/main/docs/providers/grok/design.md`.
- **Grok's own CLI** (`github.com/xai-org/grok-build`):
  - the billing call: `crates/codegen/xai-grok-shell/src/extensions/billing.rs`;
  - the refresh-token rotation and its 60 s grace: `crates/codegen/xai-grok-login/src/oidc/refresh.rs`;
  - the file lock: `manager/lock.rs`.
- **OpenChamber's Grok login break**: issue #4364, fixed by PR #4371 (`invalid_grant`, "Invalid or unknown refresh
  token").
- **Codex**:
  - a refresh-token reuse failure: `github.com/openai/codex/issues/9634`;
  - the store setting's default: `codex-rs/config/src/types.rs` (`#[default] File`);
  - the keyring names: `codex-rs/login/src/auth/storage.rs`;
  - Windows secret storage: `codex-rs/secrets/src/lib.rs` and `codex-rs/features/src/lib.rs`.
- **Claude Code on Windows**:
  - the docs, which name only the file: `code.claude.com/docs/en/authentication`;
  - the Credential Manager name and chunk format: Claude Code 2.1.326's win32 build, and Bun's
    `src/jsc/bindings/SecretsWindows.cpp`.
- No VS Code status-bar extension that shows Grok usage was found.
