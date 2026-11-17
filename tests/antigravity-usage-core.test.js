'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAntigravityQuota } = require('../src/features/antigravity-usage/antigravity-usage-core.js');

/** `agy -p /quota --output-format json` on 2026-11-17 at 20:39 UTC, with the descriptions trimmed. */
const LIVE_OUTPUT = JSON.stringify({
    conversation_id: '',
    status: 'SUCCESS',
    response: 'Gemini Models\tWeekly Limit Remaining\t98%\t2026-11-24T18:47:55Z\n',
    duration_seconds: 0,
    num_turns: 0,
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    command: {
        name: 'usage',
        data: {
            groups: [
                {
                    name: 'Gemini Models',
                    buckets: [
                        { id: 'gemini-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 0.9803217053413391, reset_time: '2026-11-24T18:47:55Z' },
                        { id: 'gemini-5h', name: 'Five Hour Limit Remaining', window: '5h', remaining_fraction: 0.9212868213653564, reset_time: '2026-11-17T23:47:55Z' },
                    ],
                },
                {
                    name: 'Claude and GPT models',
                    buckets: [
                        { id: '3p-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 1, reset_time: '2026-11-24T20:39:15Z' },
                        { id: '3p-5h', name: 'Five Hour Limit Remaining', window: '5h', remaining_fraction: 1, reset_time: '2026-11-18T01:39:15Z' },
                    ],
                },
            ],
        },
    },
});

test('the 2026-11-17 output gives four windows, 5h before weekly in each group', () => {
    const { snapshot, droppedBuckets } = parseAntigravityQuota(LIVE_OUTPUT, new Date('2026-11-17T20:39:00Z'));
    assert.equal(snapshot.agentId, 'antigravity');
    assert.deepEqual(
        snapshot.windows.map((window) => [window.id, window.label, Math.round(window.usedPercent)]),
        [
            ['gemini-5h', 'Gemini 5h', 8],
            ['gemini-weekly', 'Gemini Weekly', 2],
            ['3p-5h', 'Claude and GPT 5h', 0],
            ['3p-weekly', 'Claude and GPT Weekly', 0],
        ],
    );
    assert.equal(snapshot.windows[0].resetsAt.toISOString(), '2026-11-17T23:47:55.000Z');
    assert.deepEqual(droppedBuckets, []);
});

test('output that is not JSON is a problem quoting its first line', () => {
    const { problem } = parseAntigravityQuota('You are not logged into Antigravity.\nRun agy to sign in.', new Date());
    assert.match(problem, /^agy printed no JSON \(SyntaxError\): You are not logged into Antigravity\.$/);
});

test('a status other than SUCCESS is a problem in agy\'s own words', () => {
    const { problem } = parseAntigravityQuota(JSON.stringify({ status: 'ERROR', response: 'Sign in required' }), new Date());
    assert.equal(problem, 'agy: Sign in required');
    assert.equal(parseAntigravityQuota(JSON.stringify({ status: 'ERROR' }), new Date()).problem, 'agy: status ERROR');
});

test('a bucket without a remaining fraction is dropped and named', () => {
    const output = JSON.stringify({
        status: 'SUCCESS',
        command: { data: { groups: [{ name: 'Gemini Models', buckets: [{ id: 'gemini-5h', window: '5h' }] }] } },
    });
    const { snapshot, droppedBuckets } = parseAntigravityQuota(output, new Date());
    assert.deepEqual(snapshot.windows, []);
    assert.deepEqual(droppedBuckets, ['gemini-5h']);
});

test('an answer without groups is a problem', () => {
    assert.equal(parseAntigravityQuota(JSON.stringify({ status: 'SUCCESS', command: {} }), new Date()).problem, 'agy answered without quota groups');
});
