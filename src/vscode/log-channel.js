'use strict';
/** The "AgentUsage" log output channel, used as the log sink. */
const vscode = require('vscode');

function createLogChannel(name) {
    const channel = vscode.window.createOutputChannel(name, { log: true });
    return {
        sink: {
            error: (line) => channel.error(line),
            warn: (line) => channel.warn(line),
            info: (line) => channel.info(line),
        },
        show: () => channel.show(true),
        dispose: () => channel.dispose(),
    };
}

module.exports = { createLogChannel };
