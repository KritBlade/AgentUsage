'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { NO_BACKOFF, nextBackoff, backoffAfter, canRead, hasResetPassed } = require('../src/features/usage-polling/usage-polling-core.js');

const MINUTE = 60_000;

function backoffSequence(reason, count) {
    const waits = [];
    let backoff = NO_BACKOFF;
    for (let step = 0; step < count; step += 1) {
        backoff = nextBackoff(backoff, reason, undefined, 0);
        waits.push(backoff.failMs / MINUTE);
    }
    return waits;
}

test('errors back off 2 minutes, doubling to 60', () => {
    assert.deepEqual(backoffSequence('error', 7), [2, 4, 8, 16, 32, 60, 60]);
});

test('rate limits back off 5 minutes, doubling to 60', () => {
    assert.deepEqual(backoffSequence('rate-limited', 6), [5, 10, 20, 40, 60, 60]);
});

test('a retry-after longer than the backoff wins; a shorter one does not', () => {
    assert.equal(nextBackoff(NO_BACKOFF, 'rate-limited', 30 * MINUTE, 1000).nextAllowedMs, 1000 + 30 * MINUTE);
    assert.equal(nextBackoff(NO_BACKOFF, 'rate-limited', 1000, 1000).nextAllowedMs, 1000 + 5 * MINUTE);
});

test('success clears the backoff; not connected and an expired token keep it', () => {
    const backoff = { failMs: 4 * MINUTE, nextAllowedMs: 99 };
    assert.equal(backoffAfter(backoff, { isOk: true }, 0), NO_BACKOFF);
    assert.equal(backoffAfter(backoff, { isOk: false, reason: 'token-expired' }, 0), backoff);
    assert.equal(backoffAfter(backoff, { isOk: false, reason: 'not-connected' }, 0), backoff);
    assert.equal(backoffAfter(backoff, { isOk: false, reason: 'error' }, 0).failMs, 8 * MINUTE);
});

test('a forced read may cut an error backoff but never a rate-limit wait', () => {
    const waiting = { failMs: 2 * MINUTE, nextAllowedMs: 10 * MINUTE };
    const error = { isOk: false, reason: 'error' };
    const rateLimited = { isOk: false, reason: 'rate-limited' };
    assert.equal(canRead({ backoff: waiting, lastResult: error, isForced: false, nowMs: MINUTE }), false);
    assert.equal(canRead({ backoff: waiting, lastResult: error, isForced: true, nowMs: MINUTE }), true);
    assert.equal(canRead({ backoff: waiting, lastResult: rateLimited, isForced: true, nowMs: MINUTE }), false);
    assert.equal(canRead({ backoff: waiting, lastResult: rateLimited, isForced: false, nowMs: 10 * MINUTE }), true);
});

test('a reset that passed after the reading triggers a re-read once the reading is a minute old', () => {
    const fetchedAt = new Date(0);
    const snapshot = { fetchedAt, windows: [{ id: 'session', resetsAt: new Date(30_000) }] };
    assert.equal(hasResetPassed(snapshot, 50_000), false, 'within the guard');
    assert.equal(hasResetPassed(snapshot, 61_000), true);
    const resetBeforeReading = { fetchedAt: new Date(100_000), windows: [{ id: 'session', resetsAt: new Date(30_000) }] };
    assert.equal(hasResetPassed(resetBeforeReading, 500_000), false, 'a reset already past when read does not loop');
    assert.equal(hasResetPassed({ fetchedAt, windows: [{ id: 'weekly' }] }, 500_000), false);
    assert.equal(hasResetPassed(undefined, 500_000), false);
});
