'use strict';
/**
 * The usage vocabulary: every agent reader answers in it, and polling and display read it.
 *
 * @typedef {'claude' | 'codex' | 'grok' | 'antigravity'} AgentId
 *
 * @typedef {object} UsageShare  A part of one window, shown in the hover only.
 * @property {string} label
 * @property {number} usedPercent
 *
 * @typedef {object} UsageWindow  One quota window of one agent.
 * @property {string} id            Stable within its agent; the dot settings name the window by it.
 * @property {string} label         Short display label: `5h`, `Weekly`, `Fable`, `Gemini 5h`.
 * @property {string} [compactLabel] The label with brand icons in place of model names, `$(google-gemini) 5h`, shown
 *                                  in the status bar when agent names are hidden.
 * @property {number} usedPercent   0–100.
 * @property {Date} [resetsAt]      Absent when the provider sends none: a window with nothing used yet arrives
 *                                  without a reset time and still reads 0%.
 * @property {UsageShare[]} [breakdown]
 *
 * @typedef {object} UsageSnapshot  One successful reading of one agent.
 * @property {AgentId} agentId
 * @property {UsageWindow[]} windows   In display order.
 * @property {string} [plan]
 * @property {string[]} [notes]        Extra lines for the hover.
 * @property {Date} fetchedAt
 *
 * @typedef {'not-connected' | 'token-expired' | 'rate-limited' | 'error'} UsageFailureReason
 *
 * @typedef {object} UsageFailure
 * @property {false} isOk
 * @property {UsageFailureReason} reason
 * @property {string} [detail]         Shown in the hover.
 * @property {number} [retryAfterMs]
 *
 * @typedef {{ isOk: true, snapshot: UsageSnapshot } | UsageFailure} UsageResult
 */

/** @returns {UsageFailure} */
function usageFailure(reason, detail, retryAfterMs) {
    const failure = { isOk: false, reason };
    if (detail !== undefined) failure.detail = detail;
    if (retryAfterMs !== undefined) failure.retryAfterMs = retryAfterMs;
    return failure;
}

/** A caught error as one line for a failure's detail. */
function errorDetail(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** A provider percentage clamped to 0–100, or undefined when it is not a finite number. */
function toUsedPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.min(100, Math.max(0, value));
}

/**
 * Reads an ISO-8601 reset time. Null or absent gives `{ isValid: true }` with no `resetsAt` (no reset clock yet);
 * a wrong type or an unparseable string gives `{ isValid: false }`.
 * @returns {{ isValid: boolean, resetsAt?: Date }}
 */
function parseIsoResetTime(value) {
    if (value === null || value === undefined) return { isValid: true };
    if (typeof value !== 'string') return { isValid: false };
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? { isValid: false } : { isValid: true, resetsAt: parsed };
}

module.exports = { usageFailure, errorDetail, toUsedPercent, parseIsoResetTime };
