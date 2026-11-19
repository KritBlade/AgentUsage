'use strict';
/**
 * Grok's stored session, when to let grok renew it, and its billing answer, as pure functions.
 * `auth.json` in GROK_HOME maps `<issuer>::<id>` to a session with `key` (the access token) and `expires_at`.
 * AgentUsage only reads the token, never renews or writes it: Grok's refresh token rotates, and a renewal outside
 * `grok` can revoke its login. An expired token is renewed by grok itself, under its own `auth.json` lock, when
 * `grok agent stdio` answers ACP `initialize`.
 */
const { toUsedPercent, parseIsoResetTime } = require('../../shared/usage-window.js');

const PERIOD_LABELS = Object.freeze({
    USAGE_PERIOD_TYPE_WEEKLY: 'Weekly',
    USAGE_PERIOD_TYPE_MONTHLY: 'Monthly',
});
/** After a renewal of one expired token fails, grok is not started again for that token for this long. */
const RENEWAL_RETRY_MS = 15 * 60_000;
/**
 * `grok agent stdio` starts grok's own updater (`grok update --trigger=auto_background`), which on Windows attaches a
 * console window. Any value but empty, `0`, `false`, `off` or `no` turns it off; grok still updates when the user runs it.
 */
const AUTO_UPDATER_OFF_VARIABLE = 'GROK_DISABLE_AUTOUPDATER';

function expiryOf(entry) {
    if (typeof entry.expires_at !== 'string') return undefined;
    const expiry = new Date(entry.expires_at);
    return Number.isNaN(expiry.getTime()) ? undefined : expiry;
}

/**
 * The stored session to use: an entry whose `key` is a non-empty string; of several, the one expiring last.
 * @returns {{ token: string, expiresAt?: Date } | undefined}
 */
function pickGrokSession(authJson) {
    if (!authJson || typeof authJson !== 'object') return undefined;
    let chosen;
    for (const entry of Object.values(authJson)) {
        if (!entry || typeof entry.key !== 'string' || entry.key.length === 0) continue;
        const candidate = { token: entry.key, expiresAt: expiryOf(entry) };
        const candidateExpiry = candidate.expiresAt?.getTime() ?? -Infinity;
        const chosenExpiry = chosen?.expiresAt?.getTime() ?? -Infinity;
        if (!chosen || candidateExpiry > chosenExpiry) chosen = candidate;
    }
    return chosen;
}

function isSessionExpired(session, now) {
    return session.expiresAt !== undefined && session.expiresAt.getTime() <= now.getTime();
}

/** The environment variables `grok agent stdio` runs with: the given ones, with grok's own updater turned off. */
function agentEnvironmentVariables(environmentVariables) {
    return { ...environmentVariables, [AUTO_UPDATER_OFF_VARIABLE]: '1' };
}

/**
 * Whether to start grok to renew this expired session: yes, unless a renewal of the same token failed less than
 * RENEWAL_RETRY_MS ago. A token grok replaced has a new expiry, so it is tried at once.
 * @param {{ expiresAt?: Date }} session
 * @param {{ expiresAtMs?: number, attemptedAtMs: number } | undefined} failedRenewal
 */
function shouldTryRenewal(session, failedRenewal, nowMs) {
    if (!failedRenewal) return true;
    if (failedRenewal.expiresAtMs !== session.expiresAt?.getTime()) return true;
    return nowMs - failedRenewal.attemptedAtMs >= RENEWAL_RETRY_MS;
}

/**
 * The share of credits used, as grok's own CLI reads it (`credit_balance_from_config`): `creditUsagePercent` when
 * present; else the deprecated `used` over `monthlyLimit`; else 0, because the answer leaves the percent out while a
 * new period has nothing used.
 */
function creditUsagePercentOf(config) {
    if (config.creditUsagePercent !== undefined) return config.creditUsagePercent;
    const limit = config.monthlyLimit?.val ?? 0;
    const used = config.used?.val ?? 0;
    return limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
}

/**
 * The billing answer as a snapshot: one `credits` window over the current period, with the product split as its
 * breakdown (the products are shares of the one credit pool, not limits of their own).
 * @returns {{ snapshot: import('../../shared/usage-window.js').UsageSnapshot } | { problem: string }}
 */
function parseGrokBilling(json, fetchedAt) {
    const config = json?.config;
    if (!config || typeof config !== 'object') return { problem: 'the billing answer has no config' };
    const usedPercent = toUsedPercent(creditUsagePercentOf(config));
    if (usedPercent === undefined) return { problem: 'the billing answer has an unreadable creditUsagePercent' };
    const reset = parseIsoResetTime(config.currentPeriod?.end);
    if (!reset.isValid) return { problem: 'the billing answer has an unreadable currentPeriod.end' };
    const window = { id: 'credits', label: PERIOD_LABELS[config.currentPeriod?.type] ?? 'Credits', usedPercent };
    if (reset.resetsAt) window.resetsAt = reset.resetsAt;
    const breakdown = (Array.isArray(config.productUsage) ? config.productUsage : [])
        .map((item) => ({ label: item?.product, usedPercent: toUsedPercent(item?.usagePercent) }))
        .filter((item) => typeof item.label === 'string' && item.label.length > 0 && item.usedPercent !== undefined);
    if (breakdown.length > 0) window.breakdown = breakdown;
    return { snapshot: { agentId: 'grok', windows: [window], fetchedAt } };
}

module.exports = { pickGrokSession, isSessionExpired, agentEnvironmentVariables, shouldTryRenewal, parseGrokBilling };
