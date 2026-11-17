'use strict';
/** Reads Grok's usage with the token `grok` stored, while that token is unexpired; an expired one waits for `grok`. */
const path = require('node:path');
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure } = require('../../shared/usage-window.js');
const { fetchUsageJson } = require('../../shared/usage-http.js');
const { readCredentialsFile } = require('../../shared/credentials-file.js');
const { pickGrokSession, isSessionExpired, parseGrokBilling } = require('./grok-usage-core.js');

const log = createModuleLog('grok-usage');
const BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
/** The proxy checks the token as a CLI session token when this header is present (Grok's README, "Using auth.json for API Access"). */
const TOKEN_AUTH_HEADERS = Object.freeze({ 'X-XAI-Token-Auth': 'xai-grok-cli' });

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
async function readGrokUsage({ homedir, env }) {
    const grokHome = env.GROK_HOME || path.join(homedir, '.grok');
    const file = await readCredentialsFile(path.join(grokHome, 'auth.json'), log);
    if (file.state === 'missing') return usageFailure('not-connected');
    if (file.state === 'failed') return file.failure;
    const session = pickGrokSession(file.json);
    if (!session) {
        log.verbose('auth.json holds no session');
        return usageFailure('not-connected');
    }
    if (isSessionExpired(session, new Date())) {
        log.verbose(`stored token expired at ${session.expiresAt.toISOString()}; waiting for grok to renew it`);
        return usageFailure('token-expired');
    }
    const answer = await fetchUsageJson({
        url: BILLING_URL,
        headers: { Authorization: `Bearer ${session.token}`, ...TOKEN_AUTH_HEADERS },
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
