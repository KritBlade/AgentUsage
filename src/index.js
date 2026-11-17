'use strict';
/** Composition root: lists the agents and wires polling, display, settings, commands and the log channel. */
const os = require('node:os');
const { createModuleLog, setLogSink, setLogVerbosity } = require('./shared/log.js');
const { createLogChannel } = require('./vscode/log-channel.js');
const { readSettings, saveStatusBarDots, openSettingsPage, onSettingsChange } = require('./vscode/settings.js');
const { createStatusBar, showFocusedHover } = require('./vscode/status-bar.js');
const { pickMany, showNotice } = require('./vscode/dot-picker.js');
const { registerCommands } = require('./vscode/commands.js');
const { claudeAgent } = require('./features/claude-usage/index.js');
const { codexAgent } = require('./features/codex-usage/index.js');
const { grokAgent } = require('./features/grok-usage/index.js');
const { antigravityAgent } = require('./features/antigravity-usage/index.js');
const { createUsagePoller } = require('./features/usage-polling/index.js');
const { placeDots, buildStatusText, buildHoverMarkdown, chooseStatusBarDots } = require('./features/usage-display/index.js');

const AGENTS = Object.freeze([claudeAgent, codexAgent, grokAgent, antigravityAgent]);
const AGENT_IDS = Object.freeze(AGENTS.map((agent) => agent.id));
const COMMAND_IDS = Object.freeze({
    showUsagePopup: 'agentUsage.showUsagePopup',
    refresh: 'agentUsage.refresh',
    openSettings: 'agentUsage.openSettings',
    chooseStatusBarDots: 'agentUsage.chooseStatusBarDots',
    showLog: 'agentUsage.showLog',
});
const POLLING_SETTINGS = Object.freeze(['agents', 'refreshIntervalSeconds', 'codexCommand', 'antigravityCommand']);

function placeCurrentDots(states, settings) {
    return placeDots({ states, checkedKeys: settings.checkedDotKeys, maxDots: settings.maxStatusBarDots });
}

function activate(context) {
    const logChannel = createLogChannel('AgentUsage');
    setLogSink(logChannel.sink);
    setLogVerbosity(readSettings().logVerbosity);
    const log = createModuleLog('extension');
    const statusBar = createStatusBar({ commandId: COMMAND_IDS.showUsagePopup, enabledCommandIds: Object.values(COMMAND_IDS) });
    const poller = createUsagePoller({
        agents: AGENTS,
        readSettings,
        readEnvironment: () => {
            const settings = readSettings();
            return {
                homedir: os.homedir(),
                env: process.env,
                platform: process.platform,
                codexCommand: settings.codexCommand,
                antigravityCommand: settings.antigravityCommand,
            };
        },
        onChange: render,
    });

    function render() {
        const settings = readSettings();
        const states = poller.getEnabledStates();
        const placed = placeCurrentDots(states, settings);
        statusBar.render(
            buildStatusText(states, placed, { isAgentNameShown: settings.isAgentNameShown }),
            buildHoverMarkdown({ states, now: new Date(), commandIds: COMMAND_IDS }),
        );
    }

    function chooseDots() {
        const settings = readSettings();
        const states = poller.getEnabledStates();
        return chooseStatusBarDots({
            states,
            placed: placeCurrentDots(states, settings),
            settings,
            pickMany,
            showNotice,
            saveStatusBarDots,
            now: new Date(),
        }).catch((error) => log.error('choosing status bar dots failed:', error));
    }

    function showUsagePopup() {
        return showFocusedHover().then(undefined, (error) => log.error('opening the usage popup failed:', error));
    }

    function openSettings() {
        return openSettingsPage(context.extension.id).then(undefined, (error) =>
            log.error('opening the settings page failed:', error),
        );
    }

    /** The popup's links run these commands; each closes the popup first, as any link click should. */
    function closingPopup(handler) {
        return () => {
            statusBar.closePopup();
            return handler();
        };
    }

    context.subscriptions.push(
        logChannel,
        statusBar,
        poller,
        ...registerCommands({
            [COMMAND_IDS.showUsagePopup]: showUsagePopup,
            [COMMAND_IDS.refresh]: closingPopup(() => void poller.readAll(true)),
            [COMMAND_IDS.openSettings]: closingPopup(openSettings),
            [COMMAND_IDS.chooseStatusBarDots]: closingPopup(chooseDots),
            [COMMAND_IDS.showLog]: closingPopup(() => logChannel.show()),
        }),
        onSettingsChange((affects) => {
            if (affects('logVerbosity')) setLogVerbosity(readSettings().logVerbosity);
            if (POLLING_SETTINGS.some(affects)) poller.restart();
            render();
        }),
    );
    render();
    poller.restart();
    log.lifecycle(`activated for ${AGENT_IDS.join(', ')}`);
}

function deactivate() {}

module.exports = { activate, deactivate };
