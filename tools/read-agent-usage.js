'use strict';
/**
 * Reads each agent once with the extension's own readers, outside VS Code, and prints what the hover would list.
 * Usage: node tools/read-agent-usage.js [--verbose] [claude] [codex] [grok] [antigravity]
 * No token is printed. Codex and Antigravity are read through their own CLIs (`codex`, `agy` on PATH).
 */
const os = require('node:os');
const { setLogVerbosity } = require('../src/shared/log.js');
const { claudeAgent } = require('../src/features/claude-usage/index.js');
const { codexAgent } = require('../src/features/codex-usage/index.js');
const { grokAgent } = require('../src/features/grok-usage/index.js');
const { antigravityAgent } = require('../src/features/antigravity-usage/index.js');

const AGENTS = [claudeAgent, codexAgent, grokAgent, antigravityAgent];

function describeWindow(window) {
    const resets = window.resetsAt ? ` resets ${window.resetsAt.toISOString()}` : ' no reset time';
    const breakdown = window.breakdown ? ` [${window.breakdown.map((share) => `${share.label} ${share.usedPercent}%`).join(', ')}]` : '';
    return `${window.id.padEnd(14)} ${window.label.padEnd(22)} ${String(Math.round(window.usedPercent)).padStart(3)}%${resets}${breakdown}`;
}

async function main() {
    const args = process.argv.slice(2);
    setLogVerbosity(args.includes('--verbose') ? 'verbose' : 'off');
    const wanted = args.filter((arg) => !arg.startsWith('--'));
    const agents = wanted.length > 0 ? AGENTS.filter((agent) => wanted.includes(agent.id)) : AGENTS;
    const environment = { homedir: os.homedir(), env: process.env, platform: process.platform, codexCommand: 'codex', antigravityCommand: 'agy' };
    for (const agent of agents) {
        const startedAt = Date.now();
        const result = await agent.readUsage(environment);
        const elapsed = `${Date.now() - startedAt} ms`;
        if (!result.isOk) {
            console.log(`${agent.displayName}: ${result.reason}${result.detail ? ` (${result.detail})` : ''} — ${elapsed}`);
            continue;
        }
        const { snapshot } = result;
        console.log(`${agent.displayName}: ${snapshot.windows.length} window${snapshot.windows.length === 1 ? '' : 's'}${snapshot.plan ? `, plan ${snapshot.plan}` : ''} — ${elapsed}`);
        for (const window of snapshot.windows) console.log(`  ${describeWindow(window)}`);
        for (const note of snapshot.notes ?? []) console.log(`  note: ${note}`);
    }
}

main().catch((error) => {
    console.error('read-agent-usage failed:', error);
    process.exitCode = 1;
});
