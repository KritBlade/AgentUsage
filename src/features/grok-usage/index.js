'use strict';
/** Grok as an AgentUsage agent. */
const { readGrokUsage } = require('./grok-usage.js');

const grokAgent = Object.freeze({
    id: 'grok',
    displayName: 'Grok',
    statusBarName: 'Grok',
    icon: 'zap',
    cliCommand: 'grok',
    automaticDotOrder: Object.freeze(['credits']),
    readUsage: readGrokUsage,
});

module.exports = { grokAgent };
