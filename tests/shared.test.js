'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRetryAfterMs } = require('../src/shared/usage-http.js');
const { toUsedPercent, parseIsoResetTime, usageFailure, errorDetail } = require('../src/shared/usage-window.js');
const { parseCredentialsText } = require('../src/shared/credentials-file.js');

test('retry-after reads whole seconds and HTTP dates only', () => {
    assert.equal(parseRetryAfterMs('120', 0), 120_000);
    assert.equal(parseRetryAfterMs('Wed, 18 Nov 2026 00:00:10 GMT', Date.parse('2026-11-18T00:00:00Z')), 10_000);
    assert.equal(parseRetryAfterMs('1.5', 0), undefined);
    assert.equal(parseRetryAfterMs('', 0), undefined);
    assert.equal(parseRetryAfterMs(null, 0), undefined);
});

test('percentages clamp to 0–100; anything but a finite number is no percentage', () => {
    assert.equal(toUsedPercent(42.5), 42.5);
    assert.equal(toUsedPercent(130), 100);
    assert.equal(toUsedPercent(-3), 0);
    assert.equal(toUsedPercent('42'), undefined);
    assert.equal(toUsedPercent(Number.NaN), undefined);
});

test('a reset time: null means none yet, a bad value is invalid', () => {
    assert.deepEqual(parseIsoResetTime(null), { isValid: true });
    assert.deepEqual(parseIsoResetTime(undefined), { isValid: true });
    assert.equal(parseIsoResetTime('2026-11-18T00:29:59Z').resetsAt.toISOString(), '2026-11-18T00:29:59.000Z');
    assert.deepEqual(parseIsoResetTime('soon'), { isValid: false });
    assert.deepEqual(parseIsoResetTime(12), { isValid: false });
});

test('failures carry only the fields given', () => {
    assert.deepEqual(usageFailure('not-connected'), { isOk: false, reason: 'not-connected' });
    assert.deepEqual(usageFailure('rate-limited', undefined, 5), { isOk: false, reason: 'rate-limited', retryAfterMs: 5 });
    assert.equal(errorDetail(new RangeError('out')), 'RangeError: out');
    assert.equal(errorDetail('plain'), 'plain');
});

test('credentials text that is not JSON never puts the text in the log', () => {
    const lines = [];
    const log = { warn: (...args) => lines.push(args.join(' ')) };
    const secretText = '{"claudeAiOauth":{"accessToken":"sk-secret-value"';
    const result = parseCredentialsText(secretText, '/home/me/.claude/.credentials.json', log);
    assert.equal(result.state, 'failed');
    assert.deepEqual(result.failure, { isOk: false, reason: 'error', detail: 'Cannot parse .credentials.json' });
    assert.equal(lines.length, 1);
    assert.doesNotMatch(lines[0], /sk-secret-value/);
    // V8 quotes the text's first characters only for an unexpected token: `Unexpected token 's', "sk-secret-"...`.
    parseCredentialsText('sk-secret-value', '/home/me/.claude/.credentials.json', log);
    assert.equal(lines.length, 2);
    assert.doesNotMatch(lines[1], /sk-secret/);
    assert.deepEqual(parseCredentialsText('{"a":1}', 'x', log), { state: 'found', json: { a: 1 } });
});
