'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const display = require('../src/features/usage-display/usage-display-core.js');
const { claudeAgent } = require('../src/features/claude-usage/index.js');
const { codexAgent } = require('../src/features/codex-usage/index.js');
const { grokAgent } = require('../src/features/grok-usage/index.js');
const { antigravityAgent } = require('../src/features/antigravity-usage/index.js');

/** The real descriptors, so the automatic orders under test are the shipped ones. */
const AGENTS = { claude: claudeAgent, codex: codexAgent, grok: grokAgent, antigravity: antigravityAgent };
const COMMAND_IDS = {
    refresh: 'agentUsage.refresh',
    openSettings: 'agentUsage.openSettings',
    chooseStatusBarDots: 'agentUsage.chooseStatusBarDots',
    showLog: 'agentUsage.showLog',
};
const NOW = new Date('2026-11-17T20:31:00Z');
const WINDOWS = {
    claude: [
        { id: 'session', label: '5h', usedPercent: 4, resetsAt: new Date('2026-11-18T00:29:59Z') },
        { id: 'weekly', label: 'Weekly', usedPercent: 75, resetsAt: new Date('2026-11-18T08:59:59Z') },
        { id: 'weekly:Fable', label: 'Fable', usedPercent: 2 },
    ],
    codex: [
        { id: 'session', label: '5h', usedPercent: 10 },
        { id: 'weekly', label: 'Weekly', usedPercent: 39 },
    ],
    grok: [
        {
            id: 'credits',
            label: 'Weekly',
            usedPercent: 16,
            breakdown: [
                { label: 'GrokChat', usedPercent: 13 },
                { label: 'GrokBuild', usedPercent: 3 },
            ],
        },
    ],
    antigravity: [
        { id: 'gemini-5h', label: 'Gemini 5h', usedPercent: 7.9 },
        { id: 'gemini-weekly', label: 'Gemini Weekly', usedPercent: 2 },
        { id: '3p-5h', label: 'Claude and GPT 5h', usedPercent: 0 },
        { id: '3p-weekly', label: 'Claude and GPT Weekly', usedPercent: 0 },
    ],
};

function connectedState(agentId, extra = {}, windows = WINDOWS[agentId]) {
    const snapshot = { agentId, windows, fetchedAt: new Date('2026-11-17T20:29:00Z') };
    return { agent: AGENTS[agentId], lastResult: { isOk: true, snapshot }, lastSnapshot: snapshot, backoff: { failMs: 0, nextAllowedMs: 0 }, ...extra };
}

function labelsOf(placed) {
    return Object.fromEntries([...placed].map(([agentId, windows]) => [agentId, windows.map((window) => window.label)]));
}

function placedLabels(agentIds, { checkedKeys = [], maxDots = 4 } = {}) {
    const states = agentIds.map((id) => connectedState(id));
    return labelsOf(display.placeDots({ states, checkedKeys, maxDots }));
}

test('one agent shows its windows (D1)', () => {
    assert.deepEqual(placedLabels(['claude']), { claude: ['5h', 'Weekly', 'Fable'] });
});

test('two agents get two dots each', () => {
    assert.deepEqual(placedLabels(['claude', 'codex']), { claude: ['5h', 'Weekly'], codex: ['5h', 'Weekly'] });
});

test('an agent with one window leaves its spare to Claude (D10)', () => {
    assert.deepEqual(placedLabels(['claude', 'grok']), { claude: ['5h', 'Weekly', 'Fable'], grok: ['Weekly'] });
});

test('with three agents the fourth dot goes to the first agent', () => {
    assert.deepEqual(placedLabels(['claude', 'codex', 'grok']), { claude: ['5h', 'Weekly'], codex: ['5h'], grok: ['Weekly'] });
});

test('without Claude, the first agent in order takes the spare', () => {
    assert.deepEqual(placedLabels(['codex', 'grok', 'antigravity']), {
        codex: ['5h', 'Weekly'],
        grok: ['Weekly'],
        antigravity: ['Gemini 5h'],
    });
});

test('four agents get one dot each', () => {
    assert.deepEqual(placedLabels(['claude', 'codex', 'grok', 'antigravity']), {
        claude: ['5h'],
        codex: ['5h'],
        grok: ['Weekly'],
        antigravity: ['Gemini 5h'],
    });
});

test('checked dots show exactly, by agent and reading order, whatever order they were checked in', () => {
    const checkedKeys = ['codex/weekly', 'claude/weekly', 'claude/session'];
    assert.deepEqual(placedLabels(['claude', 'codex', 'grok', 'antigravity'], { checkedKeys }), {
        claude: ['5h', 'Weekly'],
        codex: ['Weekly'],
        grok: [],
        antigravity: [],
    });
});

test('the limit cuts checked dots in status bar order', () => {
    const checkedKeys = ['antigravity/3p-weekly', 'codex/session', 'claude/weekly:Fable', 'grok/credits'];
    assert.deepEqual(placedLabels(['claude', 'codex', 'grok', 'antigravity'], { checkedKeys, maxDots: 2 }), {
        claude: ['Fable'],
        codex: ['5h'],
        grok: [],
        antigravity: [],
    });
});

test('a checked dot without a reading is skipped, and nothing else fills its place', () => {
    const checkedKeys = ['grok/credits', 'claude/weekly:Opus', 'codex/session'];
    assert.deepEqual(placedLabels(['claude', 'codex'], { checkedKeys }), { claude: [], codex: ['5h'] });
});

test('automatic placement leaves out a window outside the agent\'s order; checking it shows it', () => {
    const withOpus = [...WINDOWS.claude, { id: 'weekly:Opus', label: 'Opus', usedPercent: 50 }];
    const states = [connectedState('claude', {}, withOpus)];
    assert.deepEqual(labelsOf(display.placeDots({ states, checkedKeys: [], maxDots: 8 })), { claude: ['5h', 'Weekly', 'Fable'] });
    assert.deepEqual(labelsOf(display.placeDots({ states, checkedKeys: ['claude/weekly:Opus'], maxDots: 8 })), { claude: ['Opus'] });
});

test('the placed dot keys follow the status bar order', () => {
    const placed = display.placeDots({ states: [connectedState('claude'), connectedState('codex')], checkedKeys: [], maxDots: 4 });
    assert.deepEqual(display.placedDotKeys(placed), ['claude/session', 'claude/weekly', 'codex/session', 'codex/weekly']);
});

test('the dot limit of 1 and of 8', () => {
    assert.deepEqual(placedLabels(['claude', 'codex', 'grok', 'antigravity'], { maxDots: 1 }), {
        claude: ['5h'],
        codex: [],
        grok: [],
        antigravity: [],
    });
    assert.deepEqual(placedLabels(['claude', 'codex'], { maxDots: 8 }), { claude: ['5h', 'Weekly', 'Fable'], codex: ['5h', 'Weekly'] });
});

test('the status text groups each agent\'s dots, marks a failed read, and can leave the names out (D15)', () => {
    const states = [
        connectedState('claude'),
        connectedState('grok', { lastResult: { isOk: false, reason: 'token-expired' } }),
    ];
    const placed = display.placeDots({ states, checkedKeys: [], maxDots: 4 });
    assert.equal(
        display.buildStatusText(states, placed, { isAgentNameShown: true }),
        '$(sparkle) Claude 🟢 5h 4% · 🟢 Weekly 75% · 🟢 Fable 2% | $(zap) Grok $(warning) 🟢 Weekly 16%',
    );
    assert.equal(
        display.buildStatusText(states, placed, { isAgentNameShown: false }),
        '$(sparkle) 🟢 5h 4% · 🟢 Weekly 75% · 🟢 Fable 2% | $(zap) $(warning) 🟢 Weekly 16%',
    );
});

test('with nothing to show, the status text names AgentUsage', () => {
    const notConnected = { agent: AGENTS.codex, lastResult: { isOk: false, reason: 'not-connected' }, backoff: { nextAllowedMs: 0 } };
    assert.equal(display.buildStatusText([notConnected], new Map(), { isAgentNameShown: true }), '$(pulse) AgentUsage');
    const failed = { agent: AGENTS.grok, lastResult: { isOk: false, reason: 'token-expired' }, backoff: { nextAllowedMs: 0 } };
    assert.equal(display.buildStatusText([failed], new Map(), { isAgentNameShown: false }), '$(pulse) AgentUsage $(warning)');
});

test('the dot colours change at 80% and 95% (D3)', () => {
    assert.equal(display.usageSignal(79.9), '🟢');
    assert.equal(display.usageSignal(80), '🟡');
    assert.equal(display.usageSignal(94.9), '🟡');
    assert.equal(display.usageSignal(95), '🔴');
});

test('the hover lists every agent: tables, breakdown, notes, failures, not connected, not read yet', () => {
    const states = [
        connectedState('claude'),
        connectedState('grok', { lastResult: { isOk: false, reason: 'token-expired' } }),
        { agent: AGENTS.codex, lastResult: { isOk: false, reason: 'not-connected' }, backoff: { nextAllowedMs: 0 } },
        { agent: AGENTS.antigravity, lastResult: undefined, backoff: { nextAllowedMs: 0 } },
    ];
    states[0].lastSnapshot = { ...states[0].lastSnapshot, plan: 'max · default_claude_max_5x', notes: ['3 free resets'] };
    const markdown = display.buildHoverMarkdown({ states, now: NOW, commandIds: COMMAND_IDS });
    assert.match(markdown, /\*\*\$\(sparkle\) Claude Code\*\* · max · default\\_claude\\_max\\_5x/);
    assert.match(markdown, /\| 🟢 \| 5h \| ▱▱▱▱▱▱▱▱▱▱ 4% \| in 3h59m · /);
    assert.match(markdown, /\| 🟢 \| Weekly \| ▰▰▰▰▰▰▰▰▱▱ 75% \| in 12h29m · /);
    assert.match(markdown, /\| 🟢 \| Fable \| ▱▱▱▱▱▱▱▱▱▱ 2% \|  \|/);
    assert.match(markdown, /Weekly: GrokChat 13% · GrokBuild 3%/);
    assert.match(markdown, /3 free resets/);
    assert.match(markdown, /⚠ Token expired\. Run `grok` once to renew it\./);
    assert.match(markdown, /\*\*Not connected:\*\* Codex \(run `codex` and sign in\)/);
    assert.match(markdown, /Reading Antigravity…/);
    assert.match(markdown, /Updated \d\d:\d\d · 2m ago/);
    assert.equal(
        markdown.split('\n').at(-1),
        '[$(refresh) Refresh](command:agentUsage.refresh) · [$(gear) Settings](command:agentUsage.openSettings) · ' +
            '[$(checklist) Status bar dots](command:agentUsage.chooseStatusBarDots) · [$(output) Log](command:agentUsage.showLog)',
    );
});

test('a rate-limited read names the next try', () => {
    const state = connectedState('claude', {
        lastResult: { isOk: false, reason: 'rate-limited' },
        backoff: { failMs: 300_000, nextAllowedMs: NOW.getTime() + 300_000 },
    });
    const markdown = display.buildHoverMarkdown({ states: [state], now: NOW, commandIds: COMMAND_IDS });
    assert.match(markdown, /⚠ The usage API answered 429; next try in 5m\./);
});

test('the checklist groups windows by agent, checks the given keys, and keeps checked keys with no reading', () => {
    const states = [
        connectedState('claude'),
        connectedState('codex'),
        { agent: AGENTS.grok, lastResult: { isOk: false, reason: 'token-expired' }, backoff: { nextAllowedMs: 0 } },
    ];
    const entries = display.buildDotPickerEntries({ states, checkedKeys: ['codex/weekly', 'grok/credits', 'claude/session'], now: NOW });
    assert.deepEqual(
        entries.map((entry) => (entry.isSeparator ? `--${entry.label}` : `${entry.isPicked ? '[x]' : '[ ]'} ${entry.label} = ${entry.value}`)),
        [
            '--Claude Code',
            '[x] 🟢 5h = claude/session',
            '[ ] 🟢 Weekly = claude/weekly',
            '[ ] 🟢 Fable = claude/weekly:Fable',
            '--Codex',
            '[ ] 🟢 5h = codex/session',
            '[x] 🟢 Weekly = codex/weekly',
            '--No reading now',
            '[x] grok/credits = grok/credits',
        ],
    );
    assert.equal(entries[1].description, '4% · resets in 3h59m');
    assert.deepEqual(display.buildDotPickerEntries({ states: [], checkedKeys: [], now: NOW }), []);
});

test('time formats', () => {
    assert.equal(display.formatRemaining(0), '0m');
    assert.equal(display.formatRemaining(61_000), '2m');
    assert.equal(display.formatRemaining((3 * 60 + 58) * 60_000), '3h58m');
    assert.equal(display.formatRemaining((6 * 24 + 22) * 3_600_000), '6d22h');
    assert.equal(display.formatAge(30_000), 'just now');
    assert.equal(display.formatAge(125_000), '2m ago');
    assert.equal(display.formatAge(125 * 60_000), '2h5m ago');
    assert.equal(display.renderBar(75), '▰▰▰▰▰▰▰▰▱▱');
});
