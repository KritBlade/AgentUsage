'use strict';
/**
 * Grok's stored session and its billing answer, as pure functions.
 * `auth.json` in GROK_HOME maps `<issuer>::<id>` to a session with `key` (the access token) and `expires_at`. The
 * token is only read, never renewed: Grok's refresh token rotates, and a renewal outside `grok` can revoke its login.
 */
const { toUsedPercent, parseIsoResetTime } = require('../../shared/usage-window.js');

const PERIOD_LABELS = Object.freeze({
    USAGE_PERIOD_TYPE_WEEKLY: 'Weekly',
    USAGE_PERIOD_TYPE_MONTHLY: 'Monthly',
});

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

/**
 * The billing answer as a snapshot: one `credits` window over the current period, with the product split as its
 * breakdown (the products are shares of the one credit pool, not limits of their own).
 * @returns {{ snapshot: import('../../shared/usage-window.js').UsageSnapshot } | { problem: string }}
 */
function parseGrokBilling(json, fetchedAt) {
    const config = json?.config;
    const usedPercent = toUsedPercent(config?.creditUsagePercent);
    if (usedPercent === undefined) return { problem: 'the billing answer has no creditUsagePercent' };
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

module.exports = { pickGrokSession, isSessionExpired, parseGrokBilling };
