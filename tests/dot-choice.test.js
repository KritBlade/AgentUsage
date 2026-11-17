'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseStatusBarDots } = require('../src/features/usage-display/dot-choice.js');
const { placeDots } = require('../src/features/usage-display/usage-display-core.js');
const { claudeAgent } = require('../src/features/claude-usage/index.js');
const { codexAgent } = require('../src/features/codex-usage/index.js');
const { grokAgent } = require('../src/features/grok-usage/index.js');

function state(agent, windowIds) {
    const snapshot = { agentId: agent.id, windows: windowIds.map((id) => ({ id, label: id, usedPercent: 10 })), fetchedAt: new Date() };
    return { agent, lastResult: { isOk: true, snapshot }, lastSnapshot: snapshot, backoff: { nextAllowedMs: 0 } };
}

const CONNECTED = [state(claudeAgent, ['session', 'weekly', 'weekly:Fable']), state(codexAgent, ['session', 'weekly'])];

/** A pickMany that records what it was shown and answers the scripted keys, or Escape. */
function scriptedPicker(answer) {
    const shown = [];
    const pickMany = async (entries, options) => {
        shown.push({ entries, options });
        return answer === 'ESCAPE' ? undefined : answer;
    };
    return { pickMany, shown };
}

async function runChoice({ states = CONNECTED, checkedDotKeys = [], maxStatusBarDots = 4, answer }) {
    const settings = { checkedDotKeys, maxStatusBarDots };
    const placed = placeDots({ states, checkedKeys: checkedDotKeys, maxDots: maxStatusBarDots });
    const { pickMany, shown } = scriptedPicker(answer);
    const saved = [];
    const notices = [];
    await chooseStatusBarDots({
        states,
        placed,
        settings,
        pickMany,
        showNotice: (message) => notices.push(message),
        saveStatusBarDots: async (keys) => saved.push(keys),
        now: new Date(),
    });
    const checked = shown[0]?.entries.filter((entry) => entry.isPicked).map((entry) => entry.value);
    return { saved, notices, checked, shown };
}

test('the checklist comes with the status bar\'s dots checked, and saves a change', async () => {
    const result = await runChoice({ answer: ['claude/session', 'codex/weekly'] });
    assert.deepEqual(result.checked, ['claude/session', 'claude/weekly', 'codex/session', 'codex/weekly']);
    assert.equal(result.shown[0].options.placeHolder, 'Check the dots to show, at most 4; check none for automatic placement');
    assert.deepEqual(result.saved, [['claude/session', 'codex/weekly']]);
    assert.deepEqual(result.notices, []);
});

test('accepting the checklist unchanged keeps automatic placement', async () => {
    const result = await runChoice({ answer: ['codex/weekly', 'codex/session', 'claude/weekly', 'claude/session'] });
    assert.deepEqual(result.saved, []);
});

test('with dots checked, the checklist shows those and saves none to return to automatic placement', async () => {
    const result = await runChoice({ checkedDotKeys: ['codex/weekly'], answer: [] });
    assert.deepEqual(result.checked, ['codex/weekly']);
    assert.deepEqual(result.saved, [[]]);
});

test('a checked dot with no reading is listed checked, so accepting keeps it', async () => {
    const states = [...CONNECTED, { agent: grokAgent, lastResult: { isOk: false, reason: 'token-expired' }, backoff: { nextAllowedMs: 0 } }];
    const result = await runChoice({ states, checkedDotKeys: ['grok/credits', 'claude/weekly'], answer: ['claude/weekly', 'grok/credits'] });
    assert.deepEqual(result.checked, ['claude/weekly', 'grok/credits']);
    assert.deepEqual(result.saved, [['claude/weekly', 'grok/credits']]);
});

test('Escape saves nothing', async () => {
    const result = await runChoice({ answer: 'ESCAPE' });
    assert.deepEqual(result.saved, []);
});

test('more dots than the limit are saved, with a notice', async () => {
    const result = await runChoice({ maxStatusBarDots: 2, answer: ['claude/session', 'claude/weekly', 'codex/weekly'] });
    assert.deepEqual(result.saved, [['claude/session', 'claude/weekly', 'codex/weekly']]);
    assert.deepEqual(result.notices, [
        "3 dots are checked and the status bar shows at most 2. Raise Max Status Bar Dots in AgentUsage's settings to see them all.",
    ]);
});

test('with no reading yet, a notice is shown instead of the checklist', async () => {
    const states = [{ agent: codexAgent, lastResult: undefined, backoff: { nextAllowedMs: 0 } }];
    const result = await runChoice({ states, answer: [] });
    assert.deepEqual(result.shown, []);
    assert.deepEqual(result.notices, ['AgentUsage has no reading yet. Refresh, then choose the dots.']);
});
