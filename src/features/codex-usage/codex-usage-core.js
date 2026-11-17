'use strict';
/**
 * Codex's `account/rateLimits/read` answer, as pure functions. Windows are told apart by length only: shorter than
 * two days is the session window, two days or more the weekly one; a window without a length is dropped.
 */
const { toUsedPercent } = require('../../shared/usage-window.js');

const WEEKLY_MIN_MINUTES = 2 * 24 * 60;

/** A reset time in epoch seconds: null or absent gives no reset time; a wrong type is invalid. */
function parseEpochSecondsResetTime(value) {
    if (value === null || value === undefined) return { isValid: true };
    if (typeof value !== 'number' || !Number.isFinite(value)) return { isValid: false };
    return { isValid: true, resetsAt: new Date(value * 1000) };
}

/** @returns {{ window: object } | { problem: string }} */
function codexWindow(raw) {
    const usedPercent = toUsedPercent(raw?.usedPercent);
    if (usedPercent === undefined) return { problem: 'no usedPercent' };
    const minutes = raw.windowDurationMins;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return { problem: 'no windowDurationMins' };
    const reset = parseEpochSecondsResetTime(raw.resetsAt);
    if (!reset.isValid) return { problem: 'unreadable resetsAt' };
    const window =
        minutes >= WEEKLY_MIN_MINUTES
            ? { id: 'weekly', label: 'Weekly', usedPercent }
            : { id: 'session', label: `${Math.max(1, Math.round(minutes / 60))}h`, usedPercent };
    if (reset.resetsAt) window.resetsAt = reset.resetsAt;
    return { window };
}

/**
 * The rate-limits answer as a snapshot, session window first.
 * @returns {{ snapshot: import('../../shared/usage-window.js').UsageSnapshot, droppedWindows: string[] }}
 */
function parseCodexRateLimits(result, fetchedAt) {
    const limits = result?.rateLimits ?? {};
    const droppedWindows = [];
    let session;
    let weekly;
    for (const slot of ['primary', 'secondary']) {
        // A slot that is null or absent is a window Codex does not have right now.
        if (limits[slot] === null || limits[slot] === undefined) continue;
        const parsed = codexWindow(limits[slot]);
        if (parsed.problem) {
            droppedWindows.push(`${slot}: ${parsed.problem}`);
            continue;
        }
        if (parsed.window.id === 'weekly') weekly ??= parsed.window;
        else session ??= parsed.window;
    }
    const snapshot = { agentId: 'codex', windows: [session, weekly].filter(Boolean), fetchedAt };
    if (typeof limits.planType === 'string' && limits.planType.length > 0) snapshot.plan = limits.planType;
    const resetCount = result?.rateLimitResetCredits?.availableCount;
    if (Number.isInteger(resetCount) && resetCount > 0) {
        snapshot.notes = [`${resetCount} free rate-limit reset${resetCount === 1 ? '' : 's'} available`];
    }
    return { snapshot, droppedWindows };
}

module.exports = { parseCodexRateLimits };
