'use strict';
/** Registers command handlers and answers their disposables. */
const vscode = require('vscode');

/** @param {Record<string, () => unknown>} handlers  command id → handler */
function registerCommands(handlers) {
    return Object.entries(handlers).map(([commandId, handler]) => vscode.commands.registerCommand(commandId, handler));
}

module.exports = { registerCommands };
