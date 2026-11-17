'use strict';
/** When to read an agent again: backoff after failures, and a re-read once a window's reset time has passed. */

const RATE_LIMITED_BASE_MS = 5 * 60_000;
const ERROR_BASE_MS = 2 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;
/** A passed reset triggers a re-read only when the reading is older than this, so clock skew cannot loop. */
const RESET_REREAD_GUARD_MS = 60_000;
const NO_BACKOFF = Object.freeze({ failMs: 0, nextAllowedMs: 0 });

/** Backoff after a rate-limited (5 min) or failed (2 min) read, doubling to 60 min; a longer retry-after wins. */
function nextBackoff(previous, reason, retryAfterMs, nowMs) {
    const baseMs = reason === 'rate-limited' ? RATE_LIMITED_BASE_MS : ERROR_BASE_MS;
    const failMs = Math.min(Math.max(previous.failMs * 2, baseMs), MAX_BACKOFF_MS);
    return { failMs, nextAllowedMs: nowMs + Math.max(failMs, retryAfterMs ?? 0) };
}

/** The backoff after a read: cleared by success, grown by a rate limit or an error, kept otherwise. */
function backoffAfter(previous, result, nowMs) {
    if (result.isOk) return NO_BACKOFF;
    if (result.reason === 'rate-limited' || result.reason === 'error') {
        return nextBackoff(previous, result.reason, result.retryAfterMs, nowMs);
    }
    return previous;
}

/** A read may run once its backoff has passed. A forced read may cut an error's backoff, never a rate-limit wait. */
function canRead({ backoff, lastResult, isForced, nowMs }) {
    if (nowMs >= backoff.nextAllowedMs) return true;
    const isRateLimited = lastResult !== undefined && !lastResult.isOk && lastResult.reason === 'rate-limited';
    return isForced && !isRateLimited;
}

/** True when a window's reset time fell between the reading and now, and the reading is old enough to re-read. */
function hasResetPassed(snapshot, nowMs) {
    if (!snapshot) return false;
    const fetchedMs = snapshot.fetchedAt.getTime();
    if (nowMs - fetchedMs <= RESET_REREAD_GUARD_MS) return false;
    return snapshot.windows.some((window) => {
        const resetMs = window.resetsAt?.getTime();
        return resetMs !== undefined && resetMs > fetchedMs && resetMs < nowMs;
    });
}

module.exports = { NO_BACKOFF, nextBackoff, backoffAfter, canRead, hasResetPassed };
