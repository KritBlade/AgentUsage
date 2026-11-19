'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    pickGrokSession,
    isSessionExpired,
    agentEnvironmentVariables,
    shouldTryRenewal,
    parseGrokBilling,
} = require('../src/features/grok-usage/grok-usage-core.js');

/** `GET /v1/billing?format=credits` on 2026-11-17 at 20:35 UTC. */
const LIVE_BILLING = {
    config: {
        currentPeriod: {
            type: 'USAGE_PERIOD_TYPE_WEEKLY',
            start: '2026-11-11T15:51:49.587933+00:00',
            end: '2026-11-18T15:51:49.587933+00:00',
        },
        creditUsagePercent: 16,
        onDemandCap: { val: 0 },
        onDemandUsed: { val: 0 },
        productUsage: [
            { product: 'GrokChat', usagePercent: 13 },
            { product: 'GrokBuild', usagePercent: 3 },
        ],
        isUnifiedBillingUser: true,
        prepaidBalance: { val: 0 },
        topUpMethod: 'TOP_UP_METHOD_SAVED_PAYMENT_METHOD',
    },
};

test('the 2026-11-17 billing answer gives Weekly 16% with the product split', () => {
    const { snapshot } = parseGrokBilling(LIVE_BILLING, new Date('2026-11-17T20:35:00Z'));
    assert.equal(snapshot.agentId, 'grok');
    assert.equal(snapshot.windows.length, 1);
    const [window] = snapshot.windows;
    assert.equal(window.id, 'credits');
    assert.equal(window.label, 'Weekly');
    assert.equal(window.usedPercent, 16);
    assert.equal(window.resetsAt.toISOString(), '2026-11-18T15:51:49.587Z');
    assert.deepEqual(window.breakdown, [
        { label: 'GrokChat', usedPercent: 13 },
        { label: 'GrokBuild', usedPercent: 3 },
    ]);
});

test('the period type names the window', () => {
    const monthly = structuredClone(LIVE_BILLING);
    monthly.config.currentPeriod.type = 'USAGE_PERIOD_TYPE_MONTHLY';
    assert.equal(parseGrokBilling(monthly, new Date()).snapshot.windows[0].label, 'Monthly');
    monthly.config.currentPeriod.type = 'SOMETHING_NEW';
    assert.equal(parseGrokBilling(monthly, new Date()).snapshot.windows[0].label, 'Credits');
});

test('a new period with nothing used leaves the percentage out, and reads as 0% as grok itself shows it', () => {
    /** `GET /v1/billing?format=credits` on 2026-11-19 at 10:17 UTC, a day into the period. */
    const unusedPeriod = {
        config: {
            currentPeriod: { type: 'USAGE_PERIOD_TYPE_WEEKLY', start: '2026-11-18T15:51:49.587933+00:00', end: '2026-11-25T15:51:49.587933+00:00' },
            onDemandCap: { val: 0 },
            onDemandUsed: { val: 0 },
            prepaidBalance: { val: 0 },
        },
    };
    const [window] = parseGrokBilling(unusedPeriod, new Date()).snapshot.windows;
    assert.deepEqual([window.label, window.usedPercent, window.resetsAt.toISOString()], ['Weekly', 0, '2026-11-25T15:51:49.587Z']);
});

test('without the percentage, the deprecated used and monthlyLimit give it', () => {
    const answer = { config: { monthlyLimit: { val: 200 }, used: { val: 50 } } };
    assert.equal(parseGrokBilling(answer, new Date()).snapshot.windows[0].usedPercent, 25);
});

test('an answer without config, or with an unreadable percentage, is a problem', () => {
    assert.deepEqual(parseGrokBilling({}, new Date()), { problem: 'the billing answer has no config' });
    assert.deepEqual(parseGrokBilling({ config: { creditUsagePercent: '16' } }, new Date()), {
        problem: 'the billing answer has an unreadable creditUsagePercent',
    });
});

test("grok agent stdio runs with grok's own updater off and every other variable kept", () => {
    const given = { PATH: '/usr/local/bin', GROK_DISABLE_AUTOUPDATER: '0' };
    assert.deepEqual(agentEnvironmentVariables(given), { PATH: '/usr/local/bin', GROK_DISABLE_AUTOUPDATER: '1' });
    assert.equal(given.GROK_DISABLE_AUTOUPDATER, '0');
});

test('grok is started again for the same expired token only 15 minutes after a failed renewal', () => {
    const session = { token: 't', expiresAt: new Date('2026-11-11T02:27:09Z') };
    const failedAtMs = Date.parse('2026-11-19T10:00:00Z');
    const failedRenewal = { expiresAtMs: session.expiresAt.getTime(), attemptedAtMs: failedAtMs };
    assert.equal(shouldTryRenewal(session, undefined, failedAtMs), true);
    assert.equal(shouldTryRenewal(session, failedRenewal, failedAtMs + 14 * 60_000), false);
    assert.equal(shouldTryRenewal(session, failedRenewal, failedAtMs + 15 * 60_000), true);
    const replaced = { token: 'u', expiresAt: new Date('2026-11-19T09:00:00Z') };
    assert.equal(shouldTryRenewal(replaced, failedRenewal, failedAtMs + 60_000), true);
});

test('of several stored sessions, the one expiring last is used', () => {
    const session = pickGrokSession({
        'https://auth.x.ai::old': { key: 'old-key', expires_at: '2026-08-23T23:44:11Z' },
        'https://auth.x.ai::new': { key: 'new-key', expires_at: '2026-11-18T02:33:03Z' },
        'https://auth.x.ai::empty': { key: '' },
    });
    assert.equal(session.token, 'new-key');
    assert.equal(session.expiresAt.toISOString(), '2026-11-18T02:33:03.000Z');
    assert.equal(pickGrokSession({ entry: { refresh_token: 'r' } }), undefined);
    assert.equal(pickGrokSession(null), undefined);
});

test('a session expires at its expires_at; one without a time never reads as expired', () => {
    const session = { token: 't', expiresAt: new Date('2026-11-18T02:33:03Z') };
    assert.equal(isSessionExpired(session, new Date('2026-11-18T02:33:02Z')), false);
    assert.equal(isSessionExpired(session, new Date('2026-11-18T02:33:03Z')), true);
    assert.equal(isSessionExpired({ token: 't' }, new Date()), false);
});
