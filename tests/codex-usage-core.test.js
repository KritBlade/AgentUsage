'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCodexRateLimits } = require('../src/features/codex-usage/codex-usage-core.js');

/** `account/rateLimits/read` on 2026-11-17 at 21:32 UTC (P1), trimmed; the reset credit ids are left out. */
const LIVE_RESULT = {
    rateLimits: {
        limitId: 'codex',
        limitName: null,
        primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 1794960573 },
        secondary: { usedPercent: 39, windowDurationMins: 10080, resetsAt: 1795031462 },
        credits: { hasCredits: false, unlimited: false, balance: '0' },
        individualLimit: null,
        spendControlReached: false,
        planType: 'plus',
        rateLimitReachedType: null,
    },
    rateLimitResetCredits: { availableCount: 3, credits: [] },
};

test('the P1 answer gives 5h 10% and Weekly 39%, with the plan and the free resets', () => {
    const { snapshot, droppedWindows } = parseCodexRateLimits(LIVE_RESULT, new Date('2026-11-17T21:32:00Z'));
    assert.deepEqual(
        snapshot.windows.map((window) => [window.id, window.label, window.usedPercent, window.resetsAt.getTime() / 1000]),
        [
            ['session', '5h', 10, 1794960573],
            ['weekly', 'Weekly', 39, 1795031462],
        ],
    );
    assert.equal(snapshot.plan, 'plus');
    assert.deepEqual(snapshot.notes, ['3 free rate-limit resets available']);
    assert.deepEqual(droppedWindows, []);
});

test('a weekly window in the primary slot reads as weekly', () => {
    const { snapshot } = parseCodexRateLimits(
        { rateLimits: { primary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: null }, secondary: null } },
        new Date(),
    );
    assert.deepEqual(snapshot.windows, [{ id: 'weekly', label: 'Weekly', usedPercent: 20 }]);
});

test('a window without a length is dropped, not guessed from its slot (D4)', () => {
    const { snapshot, droppedWindows } = parseCodexRateLimits(
        { rateLimits: { primary: { usedPercent: 5, resetsAt: 1794960573 }, secondary: { usedPercent: 7, windowDurationMins: 10080 } } },
        new Date(),
    );
    assert.deepEqual(snapshot.windows.map((window) => window.id), ['weekly']);
    assert.deepEqual(droppedWindows, ['primary: no windowDurationMins']);
});

test('the session label follows the window length', () => {
    const { snapshot } = parseCodexRateLimits({ rateLimits: { primary: { usedPercent: 1, windowDurationMins: 180 } } }, new Date());
    assert.equal(snapshot.windows[0].label, '3h');
});

test('an unreadable reset time drops the window; one free reset reads in the singular', () => {
    const { snapshot, droppedWindows } = parseCodexRateLimits(
        {
            rateLimits: { primary: { usedPercent: 1, windowDurationMins: 300, resetsAt: 'soon' } },
            rateLimitResetCredits: { availableCount: 1 },
        },
        new Date(),
    );
    assert.deepEqual(snapshot.windows, []);
    assert.deepEqual(droppedWindows, ['primary: unreadable resetsAt']);
    assert.deepEqual(snapshot.notes, ['1 free rate-limit reset available']);
});

test('no free resets means no note', () => {
    const { snapshot } = parseCodexRateLimits({ rateLimits: {}, rateLimitResetCredits: { availableCount: 0 } }, new Date());
    assert.equal('notes' in snapshot, false);
});
