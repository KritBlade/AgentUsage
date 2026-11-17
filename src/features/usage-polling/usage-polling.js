'use strict';
/**
 * Keeps every enabled agent's reading fresh: a read per agent each refresh interval, one read per agent at a time,
 * backoff after failures, a re-read when a window's reset time passes, and a redraw every 30 s for relative times.
 */
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure, errorDetail } = require('../../shared/usage-window.js');
const { NO_BACKOFF, backoffAfter, canRead, hasResetPassed } = require('./usage-polling-core.js');

const log = createModuleLog('usage-polling');
const REDRAW_TICK_MS = 30_000;
const MIN_INTERVAL_SECONDS = 30;

function describeResult(result) {
    if (result.isOk) return `${result.snapshot.windows.length} windows`;
    return result.detail ? `${result.reason} (${result.detail})` : result.reason;
}

/**
 * @param {{
 *   agents: { id: string, readUsage(environment: object): Promise<object> }[],
 *   readSettings: () => { agents: string[], refreshIntervalSeconds: number },
 *   readEnvironment: () => object,
 *   onChange: () => void,
 * }} wiring
 */
function createUsagePoller({ agents, readSettings, readEnvironment, onChange }) {
    const states = new Map(
        agents.map((agent) => [agent.id, { agent, lastResult: undefined, lastSnapshot: undefined, isReading: false, backoff: NO_BACKOFF }]),
    );
    let pollTimer;
    let redrawTimer;

    function notifyChange() {
        try {
            onChange();
        } catch (error) {
            log.error('redraw failed:', error);
        }
    }

    /** The enabled agents' states, in the order the settings list them. */
    function getEnabledStates() {
        const seen = new Set();
        return readSettings()
            .agents.filter((id) => !seen.has(id) && seen.add(id))
            .map((id) => states.get(id))
            .filter(Boolean);
    }

    async function readAgent(state, isForced) {
        if (state.isReading) return;
        if (!canRead({ backoff: state.backoff, lastResult: state.lastResult, isForced, nowMs: Date.now() })) {
            log.verbose(`${state.agent.id}: waiting until ${new Date(state.backoff.nextAllowedMs).toISOString()}`);
            return;
        }
        state.isReading = true;
        let result;
        try {
            result = await state.agent.readUsage(readEnvironment());
        } catch (error) {
            log.error(`${state.agent.id} reader threw instead of answering a failure:`, error);
            result = usageFailure('error', errorDetail(error));
        } finally {
            state.isReading = false;
        }
        state.lastResult = result;
        if (result.isOk) state.lastSnapshot = result.snapshot;
        state.backoff = backoffAfter(state.backoff, result, Date.now());
        log.verbose(`${state.agent.id}: ${describeResult(result)}`);
        notifyChange();
    }

    /** Reads every enabled agent; a forced read skips error backoff but never a rate-limit wait. */
    function readAll(isForced) {
        return Promise.all(getEnabledStates().map((state) => readAgent(state, isForced)));
    }

    function onRedrawTick() {
        const nowMs = Date.now();
        for (const state of getEnabledStates()) {
            if (hasResetPassed(state.lastSnapshot, nowMs)) void readAgent(state, false);
        }
        notifyChange();
    }

    function stopTimers() {
        clearInterval(pollTimer);
        clearInterval(redrawTimer);
    }

    /** Starts the timers with the current interval and reads every enabled agent now. */
    function restart() {
        stopTimers();
        const seconds = Math.max(MIN_INTERVAL_SECONDS, readSettings().refreshIntervalSeconds);
        pollTimer = setInterval(() => void readAll(false), seconds * 1000);
        redrawTimer = setInterval(onRedrawTick, REDRAW_TICK_MS);
        log.lifecycle(`reading every ${seconds} s`);
        void readAll(true);
    }

    return { restart, readAll, getEnabledStates, dispose: stopTimers };
}

module.exports = { createUsagePoller };
