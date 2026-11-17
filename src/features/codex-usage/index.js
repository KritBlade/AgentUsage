'use strict';
/** Codex as an AgentUsage agent. */
const { readCodexUsage } = require('./codex-usage.js');

const codexAgent = Object.freeze({
    id: 'codex',
    displayName: 'Codex',
    statusBarName: 'Codex',
    icon: 'hubot',
    cliCommand: 'codex',
    automaticDotOrder: Object.freeze(['session', 'weekly']),
    readUsage: readCodexUsage,
});

module.exports = { codexAgent };
