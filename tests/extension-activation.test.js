'use strict';
/**
 * Activates src/index.js against a stand-in for the editor API and four stand-in agents that read nothing, then runs
 * the registered commands and records, in order, what they did to the status bar item and which editor commands
 * they ran.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const SOURCE_ROOT = path.join(__dirname, '..', 'src') + path.sep;
const MANIFEST = require('../package.json');
const DECLARED = MANIFEST.contributes.configuration.properties;
const AGENT_FEATURE = /[\\/]features[\\/](claude|codex|grok|antigravity)-usage[\\/]index\.js$/;

function createEditorStandIn() {
    const calls = [];
    const handlers = new Map();
    const item = {
        show: () => calls.push(['item.show']),
        hide: () => calls.push(['item.hide']),
        dispose: () => {},
    };
    const editor = {
        StatusBarAlignment: { Left: 1, Right: 2 },
        ConfigurationTarget: { Global: 1 },
        QuickPickItemKind: { Separator: -1 },
        MarkdownString: class {
            constructor(value, supportThemeIcons) {
                this.value = value;
                this.supportThemeIcons = supportThemeIcons;
            }
        },
        window: {
            createStatusBarItem: () => item,
            createOutputChannel: () => ({ error() {}, warn() {}, info() {}, show: () => calls.push(['log.show']), dispose() {} }),
            showQuickPick: async () => undefined,
            showInformationMessage: async () => undefined,
        },
        commands: {
            registerCommand: (commandId, handler) => {
                handlers.set(commandId, handler);
                return { dispose() {} };
            },
            executeCommand: async (...args) => {
                calls.push(['executeCommand', ...args]);
            },
        },
        workspace: {
            getConfiguration: (section) => ({
                get: (key) => DECLARED[`${section}.${key}`]?.default,
                inspect: (key) => ({ defaultValue: DECLARED[`${section}.${key}`]?.default }),
                update: async () => {},
            }),
            onDidChangeConfiguration: () => ({ dispose() {} }),
        },
    };
    return { editor, item, calls, handlers };
}

function standInAgent(id) {
    return {
        [`${id}Agent`]: Object.freeze({
            id,
            displayName: id,
            statusBarName: id,
            icon: 'circle',
            cliCommand: id,
            automaticDotOrder: Object.freeze([]),
            readUsage: async () => ({ isOk: false, reason: 'not-connected' }),
        }),
    };
}

function activateWithStandIns(t) {
    const standIn = createEditorStandIn();
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.startsWith(SOURCE_ROOT)) delete require.cache[modulePath];
    }
    const originalLoad = Module._load;
    Module._load = function loadWithStandIns(request, parent, ...rest) {
        if (request === 'vscode') return standIn.editor;
        const agentMatch = AGENT_FEATURE.exec(request);
        if (agentMatch) return standInAgent(agentMatch[1]);
        return originalLoad.call(this, request, parent, ...rest);
    };
    const context = { subscriptions: [], extension: { id: 'kritblade.agent-usage' } };
    let log;
    try {
        log = require('../src/shared/log.js');
        require('../src/index.js').activate(context);
    } finally {
        Module._load = originalLoad;
    }
    t.after(() => {
        for (const subscription of context.subscriptions) subscription.dispose();
        log.setLogSink(undefined);
    });
    return standIn;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a click opens the popup at once, and that command stays out of the Command Palette (D17)', async (t) => {
    const { item, calls, handlers } = activateWithStandIns(t);
    assert.equal(item.command, 'agentUsage.showUsagePopup');
    assert.deepEqual([...handlers.keys()].sort(), MANIFEST.contributes.commands.map((command) => command.command).sort());
    assert.deepEqual(MANIFEST.contributes.menus.commandPalette, [{ command: 'agentUsage.showUsagePopup', when: 'false' }]);
    await settle();
    calls.length = 0;
    await handlers.get('agentUsage.showUsagePopup')();
    assert.deepEqual(calls, [['executeCommand', 'workbench.action.showHover']]);
});

test('each popup link closes the popup before it acts', async (t) => {
    const { calls, handlers } = activateWithStandIns(t);
    await settle();
    const linkActions = {
        'agentUsage.openSettings': ['executeCommand', 'workbench.action.openSettings', '@ext:kritblade.agent-usage'],
        'agentUsage.showLog': ['log.show'],
        'agentUsage.refresh': undefined,
        'agentUsage.chooseStatusBarDots': undefined,
    };
    for (const [commandId, action] of Object.entries(linkActions)) {
        calls.length = 0;
        await handlers.get(commandId)();
        assert.deepEqual(calls.slice(0, 2), [['item.hide'], ['item.show']], `${commandId} closes the popup first`);
        if (action) assert.deepEqual(calls[2], action, `${commandId} then acts`);
        await settle();
    }
});
