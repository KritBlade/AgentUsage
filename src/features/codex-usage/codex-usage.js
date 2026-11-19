'use strict';
/**
 * Reads Codex's usage through its own app-server: `codex -s read-only -a never app-server` speaks newline-delimited
 * JSON-RPC on stdio. Codex reads its login from whichever store it uses and renews its own token, so AgentUsage never
 * touches a Codex token. After the read, stdin is closed and Codex exits by itself.
 */
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure, errorDetail } = require('../../shared/usage-window.js');
const { startJsonRpcProcess } = require('../../shared/json-rpc-process.js');
const { parseCodexRateLimits } = require('./codex-usage-core.js');

const log = createModuleLog('codex-usage');
const APP_SERVER_ARGS = Object.freeze(['-s', 'read-only', '-a', 'never', 'app-server']);
const CLIENT_INFO = Object.freeze({ name: 'agent-usage', version: '0.1.0' });
const INITIALIZE_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const EXIT_GRACE_MS = 10_000;

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
async function readCodexUsage({ codexCommand }) {
    const session = startJsonRpcProcess({
        command: codexCommand,
        args: APP_SERVER_ARGS,
        processName: 'codex app-server',
        log,
        exitGraceMs: EXIT_GRACE_MS,
    });
    const startError = await session.started;
    if (startError) {
        if (startError.code === 'ENOENT') {
            // EXPECTED: Codex is not installed, or not on VS Code's PATH.
            log.verbose(`${codexCommand} not found`);
            return usageFailure('not-connected', `${codexCommand} not found`);
        }
        log.warn(`cannot start ${codexCommand} app-server:`, startError);
        return usageFailure('error', errorDetail(startError));
    }
    try {
        await session.request('initialize', { clientInfo: CLIENT_INFO }, INITIALIZE_TIMEOUT_MS);
        session.notify('initialized', {});
        const result = await session.request('account/rateLimits/read', {}, REQUEST_TIMEOUT_MS);
        log.trace('rate limits:', result);
        const { snapshot, droppedWindows } = parseCodexRateLimits(result, new Date());
        if (droppedWindows.length > 0) log.warn(`dropped Codex windows: ${droppedWindows.join('; ')}`);
        log.verbose(`read ${snapshot.windows.length} windows`);
        return { isOk: true, snapshot };
    } catch (error) {
        const stderr = session.stderrTail.join(' | ').slice(0, 300);
        log.warn('codex app-server read failed:', error, stderr ? `(stderr: ${stderr})` : '');
        return usageFailure('error', error instanceof Error ? error.message : String(error));
    } finally {
        await session.close();
    }
}

module.exports = { readCodexUsage };
