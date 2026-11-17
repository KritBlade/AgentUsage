'use strict';
/** Claude Code as an AgentUsage agent. */
const { readClaudeUsage } = require('./claude-usage.js');

const claudeAgent = Object.freeze({
    id: 'claude',
    displayName: 'Claude Code',
    statusBarName: 'Claude',
    icon: 'sparkle',
    cliCommand: 'claude',
    /** The windows automatic placement shows first: 5h, Weekly, then Fable's weekly limit. */
    automaticDotOrder: Object.freeze(['session', 'weekly', 'weekly:Fable']),
    readUsage: readClaudeUsage,
});

module.exports = { claudeAgent };
