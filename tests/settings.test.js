'use strict';
/**
 * src/vscode/settings.js against a stand-in for the editor API whose configuration answers package.json's declared
 * defaults, plus the checks that keep package.json, the agent descriptors and src/index.js in step.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { setLogSink } = require('../src/shared/log.js');
const { claudeAgent } = require('../src/features/claude-usage/index.js');
const { codexAgent } = require('../src/features/codex-usage/index.js');
const { grokAgent } = require('../src/features/grok-usage/index.js');
const { antigravityAgent } = require('../src/features/antigravity-usage/index.js');
const { buildHoverMarkdown } = require('../src/features/usage-display/index.js');

const MANIFEST = require('../package.json');
const DECLARED = MANIFEST.contributes.configuration.properties;
const SETTINGS_PATH = require.resolve('../src/vscode/settings.js');
const GLOBAL_TARGET = 1;

/** Loads settings.js with `userValues` (keys without `agentUsage.`) over the declared defaults. */
function loadSettings(userValues = {}) {
    const readKeys = new Set();
    const updates = [];
    const commands = [];
    const editor = {
        workspace: {
            getConfiguration: (section) => ({
                get: (key) => {
                    readKeys.add(`${section}.${key}`);
                    return key in userValues ? userValues[key] : DECLARED[`${section}.${key}`]?.default;
                },
                inspect: (key) => ({ defaultValue: DECLARED[`${section}.${key}`]?.default }),
                update: async (key, value, target) => updates.push([key, value, target]),
            }),
            onDidChangeConfiguration: () => ({ dispose() {} }),
        },
        ConfigurationTarget: { Global: GLOBAL_TARGET },
        commands: { executeCommand: async (...args) => commands.push(args) },
    };
    const originalLoad = Module._load;
    Module._load = function loadWithEditorStandIn(request, ...rest) {
        if (request === 'vscode') return editor;
        return originalLoad.call(this, request, ...rest);
    };
    try {
        delete require.cache[SETTINGS_PATH];
        return { settingsModule: require(SETTINGS_PATH), readKeys, updates, commands };
    } finally {
        Module._load = originalLoad;
    }
}

function captureWarnings(t) {
    const warnings = [];
    setLogSink({ error: (line) => warnings.push(line), warn: (line) => warnings.push(line), info: () => {} });
    t.after(() => setLogSink(undefined));
    return warnings;
}

test('the declared defaults read back with no warning, and every declared setting is read', (t) => {
    const warnings = captureWarnings(t);
    const { settingsModule, readKeys } = loadSettings();
    assert.deepEqual(settingsModule.readSettings(), {
        agents: ['claude', 'codex', 'grok', 'antigravity'],
        checkedDotKeys: [],
        maxStatusBarDots: 4,
        isAgentNameShown: true,
        refreshIntervalSeconds: 60,
        codexCommand: 'codex',
        grokCommand: 'grok',
        antigravityCommand: 'agy',
        logVerbosity: 'off',
    });
    assert.deepEqual(warnings, []);
    assert.deepEqual([...readKeys].sort(), Object.keys(DECLARED).sort());
});

test('checked dots read as their keys; a wrong value falls back to its default with one warning', (t) => {
    const warnings = captureWarnings(t);
    const checked = loadSettings({ statusBarDots: { 'claude/session': true, 'codex/weekly': false, 'grok/credits': true } });
    assert.deepEqual(checked.settingsModule.readSettings().checkedDotKeys, ['claude/session', 'grok/credits']);
    assert.deepEqual(warnings, []);

    const wrong = loadSettings({ statusBarDots: ['claude/session'], isAgentNameShown: 'no' });
    const settings = wrong.settingsModule.readSettings();
    wrong.settingsModule.readSettings();
    assert.deepEqual(settings.checkedDotKeys, []);
    assert.equal(settings.isAgentNameShown, true);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /agentUsage\.statusBarDots should be an object/);
    assert.match(warnings[1], /agentUsage\.isAgentNameShown should be true or false but is "no"; using its default true/);
});

test('saving dots writes the checked keys to the user settings, and saving none removes the setting', async () => {
    const { settingsModule, updates } = loadSettings();
    await settingsModule.saveStatusBarDots(['claude/session', 'codex/weekly']);
    await settingsModule.saveStatusBarDots([]);
    assert.deepEqual(updates, [
        ['statusBarDots', { 'claude/session': true, 'codex/weekly': true }, GLOBAL_TARGET],
        ['statusBarDots', undefined, GLOBAL_TARGET],
    ]);
});

test('the settings page opens filtered to the extension (D14)', async () => {
    const { settingsModule, commands } = loadSettings();
    await settingsModule.openSettingsPage('kritblade.agent-usage');
    assert.deepEqual(commands, [['workbench.action.openSettings', '@ext:kritblade.agent-usage']]);
});

test('the dot setting declares no window of its own: any agent\'s window key is a boolean, and it points to Status bar dots', () => {
    const statusBarDots = DECLARED['agentUsage.statusBarDots'];
    // No declared properties and no additionalProperties: VS Code's settings page shows "Edit in settings.json", not checkboxes.
    assert.equal(statusBarDots.properties, undefined);
    assert.equal(statusBarDots.additionalProperties, undefined);
    assert.deepEqual(statusBarDots.default, {});
    const patterns = Object.entries(statusBarDots.patternProperties);
    assert.equal(patterns.length, 1);
    const [pattern, valueSchema] = patterns[0];
    assert.deepEqual(valueSchema, { type: 'boolean' });
    const keyPattern = new RegExp(pattern);
    const agents = [claudeAgent, codexAgent, grokAgent, antigravityAgent];
    const windowKeys = agents.flatMap((agent) => agent.automaticDotOrder.map((windowId) => `${agent.id}/${windowId}`));
    for (const key of [...windowKeys, 'antigravity/gemini-argon-wtu-weekly']) assert.match(key, keyPattern);
    assert.doesNotMatch('unknown/weekly', keyPattern);
    const commandIds = {
        refresh: 'agentUsage.refresh',
        openSettings: 'agentUsage.openSettings',
        chooseStatusBarDots: 'agentUsage.chooseStatusBarDots',
        showLog: 'agentUsage.showLog',
    };
    const hover = buildHoverMarkdown({ states: [], now: new Date(), commandIds });
    const linkLabel = hover.match(/\[\$\(checklist\) ([^\]]+)\]\(command:agentUsage\.chooseStatusBarDots\)/)?.[1];
    assert.ok(linkLabel, 'the popup has a Status bar dots link');
    assert.ok(statusBarDots.markdownDescription.includes(`click ${linkLabel} in the popup`), `the description names the popup's "${linkLabel}" link`);
});

test('the commands in package.json are the ones src/index.js registers', () => {
    const indexText = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
    const registered = [...indexText.matchAll(/'(agentUsage\.\w+)'/g)].map((match) => match[1]);
    assert.deepEqual(registered.sort(), MANIFEST.contributes.commands.map((command) => command.command).sort());
});