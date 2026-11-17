'use strict';
/**
 * GET a provider's usage endpoint and turn the HTTP outcome into usage terms.
 * 401 and 403 mean the token expired; 429 means rate-limited (with the server's retry-after); any other non-2xx,
 * a network error, a timeout or unreadable JSON is an error. Request headers are never logged: they carry the token.
 */
const { usageFailure, errorDetail } = require('./usage-window.js');

const REQUEST_TIMEOUT_MS = 15_000;

/** The `retry-after` header in milliseconds: whole seconds or an HTTP date; undefined when absent or unreadable. */
function parseRetryAfterMs(value, nowMs) {
    if (!value) return undefined;
    if (/^\d+$/.test(value)) return Number(value) * 1000;
    // An HTTP date always has letters; without this check Date.parse reads values like '1.5' as dates.
    if (!/[A-Za-z]/.test(value)) return undefined;
    const dateMs = Date.parse(value);
    return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - nowMs);
}

/**
 * @param {{ url: string, headers: Record<string, string>, log: ReturnType<import('./log.js')['createModuleLog']> }} request
 * @returns {Promise<{ isOk: true, json: unknown } | { isOk: false, failure: import('./usage-window.js').UsageFailure }>}
 */
async function fetchUsageJson({ url, headers, log }) {
    const host = new URL(url).host;
    let response;
    try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
        log.warn(`request to ${host} failed:`, error);
        return { isOk: false, failure: usageFailure('error', errorDetail(error)) };
    }
    if (response.status === 401 || response.status === 403) {
        log.warn(`${host} refused the token (HTTP ${response.status})`);
        return { isOk: false, failure: usageFailure('token-expired') };
    }
    if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'), Date.now());
        log.warn(`${host} rate-limited the request (HTTP 429, retry-after ${retryAfterMs ?? 'not given'} ms)`);
        return { isOk: false, failure: usageFailure('rate-limited', undefined, retryAfterMs) };
    }
    if (!response.ok) {
        log.warn(`${host} answered HTTP ${response.status}`);
        return { isOk: false, failure: usageFailure('error', `HTTP ${response.status} from ${host}`) };
    }
    try {
        const json = await response.json();
        log.trace(`${host} answered:`, json);
        return { isOk: true, json };
    } catch (error) {
        log.warn(`${host} answered unreadable JSON:`, error);
        return { isOk: false, failure: usageFailure('error', `Unreadable answer from ${host}`) };
    }
}

module.exports = { fetchUsageJson, parseRetryAfterMs };
