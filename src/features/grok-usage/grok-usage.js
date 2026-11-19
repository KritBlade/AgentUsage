'use strict';
/**
 * Reads Grok's usage with the token `grok` stored. While the token is unexpired, the billing endpoint is read with it.
 * Once it has expired, `grok agent stdio` is started and sent ACP `initialize`, during which grok renews the token
 * itself, under its own `auth.json` lock, and writes it back; the file is then read again. AgentUsage never renews or
 * writes a Grok token. When grok cannot renew (a dead refresh token, or `grok` not found), the read answers
 * token expired, and grok is not started again for that token for 15 minutes.
 */
const path = require('node:path');
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure } = require('../../shared/usage-window.js');
const { fetchUsageJson } = require('../../shared/usage-http.js');
const { readCredentialsFile } = require('../../shared/credentials-file.js');
const { startJsonRpcProcess } = require('../../shared/json-rpc-process.js');
const { pickGrokSession, isSessionExpired, agentEnvironmentVariables, shouldTryRenewal, parseGrokBilling } = require('./grok-usage-core.js');

const log = createModuleLog('grok-usage');
const BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
/** The proxy checks the token as a CLI session token when this header is present (Grok's README, "Using auth.json for API Access"). */
const TOKEN_AUTH_HEADERS = Object.freeze({ 'X-XAI-Token-Auth': 'xai-grok-cli' });
const AGENT_ARGS = Object.freeze(['agent', 'stdio']);
const INITIALIZE_PARAMS = Object.freeze({
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
});
const INITIALIZE_TIMEOUT_MS = 30_000;
const EXIT_GRACE_MS = 10_000;

/** The last renewal that left the token expired, so grok is not started for the same token every minute. */
let failedRenewal;

/** @returns {Promise<{ session: { token: string, expiresAt?: Date } } | { failure: import('../../shared/usage-window.js').UsageFailure }>} */
async function readStoredSession(authPath) {
    const file = await readCredentialsFile(authPath, log);
    if (file.state === 'missing') return { failure: usageFailure('not-connected') };
    if (file.state === 'failed') return { failure: file.failure };
    const session = pickGrokSession(file.json);
    if (!session) {
        log.verbose('auth.json holds no session');
        return { failure: usageFailure('not-connected') };
    }
    return { session };
}

/** Starts `grok agent stdio`, sends ACP `initialize` (grok renews an expired token before it answers), then closes it. */
async function letGrokRenew({ grokCommand, homedir, env }) {
    const agent = startJsonRpcProcess({
        command: grokCommand,
        args: AGENT_ARGS,
        processName: 'grok agent stdio',
        log,
        exitGraceMs: EXIT_GRACE_MS,
        env: agentEnvironmentVariables(env),
        cwd: homedir,
    });
    const startError = await agent.started;
    if (startError) {
        if (startError.code === 'ENOENT') {
            // EXPECTED: grok is not installed, or not on VS Code's PATH; the expired token then waits for the user.
            log.verbose(`${grokCommand} not found, so grok cannot renew its token`);
            return;
        }
        log.warn(`cannot start ${grokCommand} agent stdio:`, startError);
        return;
    }
    try {
        await agent.request('initialize', INITIALIZE_PARAMS, INITIALIZE_TIMEOUT_MS);
    } catch (error) {
        const stderr = agent.stderrTail.join(' | ').slice(0, 300);
        log.warn('grok agent stdio initialize failed:', error, stderr ? `(stderr: ${stderr})` : '');
    } finally {
        await agent.close();
    }
}

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
async function readGrokUsage({ homedir, env, grokCommand }) {
    const authPath = path.join(env.GROK_HOME || path.join(homedir, '.grok'), 'auth.json');
    let stored = await readStoredSession(authPath);
    if (stored.failure) return stored.failure;
    if (isSessionExpired(stored.session, new Date())) {
        if (!shouldTryRenewal(stored.session, failedRenewal, Date.now())) {
            log.verbose('stored token still expired; grok failed to renew it less than 15 minutes ago');
            return usageFailure('token-expired');
        }
        log.verbose(`stored token expired at ${stored.session.expiresAt.toISOString()}; starting grok to renew it`);
        await letGrokRenew({ grokCommand, homedir, env });
        stored = await readStoredSession(authPath);
        if (stored.failure) return stored.failure;
        if (isSessionExpired(stored.session, new Date())) {
            failedRenewal = { expiresAtMs: stored.session.expiresAt?.getTime(), attemptedAtMs: Date.now() };
            log.warn('grok did not renew its expired token; run grok to sign in again');
            return usageFailure('token-expired');
        }
        failedRenewal = undefined;
        log.verbose(`grok renewed its token, now expiring at ${stored.session.expiresAt?.toISOString() ?? 'no stated time'}`);
    }
    const answer = await fetchUsageJson({
        url: BILLING_URL,
        headers: { Authorization: `Bearer ${stored.session.token}`, ...TOKEN_AUTH_HEADERS },
        log,
    });
    if (!answer.isOk) return answer.failure;
    const parsed = parseGrokBilling(answer.json, new Date());
    if (parsed.problem) {
        log.warn(parsed.problem);
        return usageFailure('error', parsed.problem);
    }
    log.verbose(`read ${parsed.snapshot.windows.length} window`);
    return { isOk: true, snapshot: parsed.snapshot };
}

module.exports = { readGrokUsage };
