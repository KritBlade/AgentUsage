'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickGrokSession, isSessionExpired, parseGrokBilling } = require('../src/features/grok-usage/grok-usage-core.js');

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

test('an answer without the credit percentage is a problem', () => {
    assert.deepEqual(parseGrokBilling({ config: {} }, new Date()), { problem: 'the billing answer has no creditUsagePercent' });
    assert.ok(parseGrokBilling({}, new Date()).problem);
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
