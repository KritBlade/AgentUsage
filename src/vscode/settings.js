'use strict';
/**
 * AgentUsage's settings: read with type checks, save the checked status bar dots, open the settings page, and report
 * which keys changed.
 */
const vscode = require('vscode');
const { createModuleLog, LOG_VERBOSITY_NAMES } = require('../shared/log.js');

const log = createModuleLog('settings');
const SECTION = 'agentUsage';
const warnedValues = new Set();

function configuration() {
    return vscode.workspace.getConfiguration(SECTION);
}

/** The setting's value when it passes `isValid`; otherwise its declared default, with one warning per bad value. */
function checkedValue(settings, key, isValid, expectation) {
    const value = settings.get(key);
    if (isValid(value)) return value;
    const defaultValue = settings.inspect(key)?.defaultValue;
    const warningKey = `${key}=${JSON.stringify(value)}`;
    if (!warnedValues.has(warningKey)) {
        warnedValues.add(warningKey);
        log.warn(
            `setting ${SECTION}.${key} should be ${expectation} but is ${JSON.stringify(value)}; ` +
                `using its default ${JSON.stringify(defaultValue)}`,
        );
    }
    return defaultValue;
}

const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isCheckboxObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'boolean');

function readSettings() {
    const settings = configuration();
    const statusBarDots = checkedValue(settings, 'statusBarDots', isCheckboxObject, 'an object of "<agent>/<window id>": true or false');
    return {
        agents: checkedValue(settings, 'agents', isStringList, 'a list of agent ids'),
        /** The dot keys checked in `agentUsage.statusBarDots`; empty means automatic placement. */
        checkedDotKeys: Object.keys(statusBarDots).filter((key) => statusBarDots[key] === true),
        maxStatusBarDots: checkedValue(
            settings,
            'maxStatusBarDots',
            (value) => Number.isInteger(value) && value >= 1 && value <= 8,
            'a whole number from 1 to 8',
        ),
        isAgentNameShown: checkedValue(settings, 'isAgentNameShown', (value) => typeof value === 'boolean', 'true or false'),
        refreshIntervalSeconds: checkedValue(
            settings,
            'refreshIntervalSeconds',
            (value) => typeof value === 'number' && value >= 30,
            'a number of seconds, at least 30',
        ),
        codexCommand: checkedValue(settings, 'codexCommand', isNonEmptyString, 'a command name or path'),
        antigravityCommand: checkedValue(settings, 'antigravityCommand', isNonEmptyString, 'a command name or path'),
        logVerbosity: checkedValue(
            settings,
            'logVerbosity',
            (value) => LOG_VERBOSITY_NAMES.includes(value),
            `one of ${LOG_VERBOSITY_NAMES.join(', ')}`,
        ),
    };
}

/** Saves the checked dots in the user settings; none checked removes the setting, which means automatic placement. */
function saveStatusBarDots(keys) {
    const value = keys.length > 0 ? Object.fromEntries(keys.map((key) => [key, true])) : undefined;
    return configuration().update('statusBarDots', value, vscode.ConfigurationTarget.Global);
}

/** Opens VS Code's settings page filtered to one extension's settings. */
function openSettingsPage(extensionId) {
    return vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${extensionId}`);
}

/** Calls `listener(affects)` when an AgentUsage setting changes; `affects(key)` tells whether `agentUsage.<key>` did. */
function onSettingsChange(listener) {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(SECTION)) listener((key) => event.affectsConfiguration(`${SECTION}.${key}`));
    });
}

module.exports = { readSettings, saveStatusBarDots, openSettingsPage, onSettingsChange };
