'use strict';
/** Antigravity (the `agy` CLI) as an AgentUsage agent. */
const { readAntigravityUsage } = require('./antigravity-usage.js');

const antigravityAgent = Object.freeze({
    id: 'antigravity',
    displayName: 'Antigravity',
    statusBarName: 'Antigravity',
    icon: 'rocket',
    cliCommand: 'agy',
    /** Gemini's group first, then the Claude and GPT group (`3p`); 5h before Weekly in each. */
    automaticDotOrder: Object.freeze(['gemini-5h', 'gemini-weekly', '3p-5h', '3p-weekly']),
    readUsage: readAntigravityUsage,
});

module.exports = { antigravityAgent };
