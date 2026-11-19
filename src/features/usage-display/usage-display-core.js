'use strict';
/**
 * What AgentUsage shows, as pure functions: which windows get the status bar's dots, the status text, the hover
 * markdown, and the dot checklist's entries.
 *
 * An agent state is `{ agent, lastResult?, lastSnapshot?, backoff }`, as usage polling keeps it; `agent` carries `id`,
 * `displayName`, `statusBarName`, `icon`, `cliCommand` and `automaticDotOrder`. A dot key is `<agent id>/<window id>`.
 */

const WARNING_PERCENT = 80;
const CRITICAL_PERCENT = 95;
const BAR_CELLS = 10;
/**
 * Between agents: a bar with an en space on each side. Some icons, such as `$(rocket)`, are drawn to the left edge of
 * their glyph, and with plain spaces the bar ran into them.
 */
const SEGMENT_SEPARATOR = '\u2002|\u2002';
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en', { weekday: 'short' });

/** 🟢 below 80%, 🟡 from 80%, 🔴 from 95%. */
function usageSignal(percent) {
    if (percent >= CRITICAL_PERCENT) return '🔴';
    if (percent >= WARNING_PERCENT) return '🟡';
    return '🟢';
}

function renderBar(percent, cells = BAR_CELLS) {
    const clamped = Math.min(100, Math.max(0, percent));
    const filled = Math.round((clamped / 100) * cells);
    return '▰'.repeat(filled) + '▱'.repeat(cells - filled);
}

/** Time until a reset, rounded up to the minute: `3h58m`, `6d22h`, `12m`. */
function formatRemaining(ms) {
    if (ms <= 0) return '0m';
    const totalMinutes = Math.ceil(ms / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d${hours}h`;
    if (hours > 0) return `${hours}h${minutes}m`;
    return `${minutes}m`;
}

/** Time since a reading, rounded down: `just now`, `4m ago`, `2h5m ago`, `1d3h ago`. */
function formatAge(ms) {
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h${minutes % 60}m ago`;
    return `${Math.floor(hours / 24)}d${hours % 24}h ago`;
}

function twoDigits(number) {
    return String(number).padStart(2, '0');
}

/** `11/18(Wed) 00:29`, in local time. */
function formatClock(date) {
    return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_FORMAT.format(date)}) ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function formatTime(date) {
    return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** Escapes text that came from a provider or the settings, for markdown and table cells. */
function escapeMarkdown(text) {
    return String(text).replace(/[\\`*_{}[\]()#+!|<>~]/g, '\\$&');
}

function dotKey(agentId, windowId) {
    return `${agentId}/${windowId}`;
}

/** True when the agent's last read failed for a reason other than not being connected. */
function hasFailedRead(state) {
    return state.lastResult !== undefined && !state.lastResult.isOk && state.lastResult.reason !== 'not-connected';
}

/** Exactly the checked windows that the readings have, by agent and then reading order, up to `maxDots`. */
function placeCheckedDots(connected, checkedKeys, maxDots, placed) {
    const checked = new Set(checkedKeys);
    let freeCount = maxDots;
    for (const state of connected) {
        for (const window of state.lastSnapshot.windows) {
            if (freeCount <= 0) return placed;
            if (!checked.has(dotKey(state.agent.id, window.id))) continue;
            placed.get(state.agent.id).push(window);
            freeCount -= 1;
        }
    }
    return placed;
}

/**
 * Automatic placement:
 * 1. Each agent's fair share: the first ⌊maxDots ÷ agents⌋ windows of its `automaticDotOrder` that its reading has.
 * 2. The places left: the first agent's next windows in its order, then the next agent's.
 */
function placeAutomaticDots(connected, maxDots, placed) {
    const takenKeys = new Set();
    let freeCount = maxDots;
    const take = (state, window) => {
        placed.get(state.agent.id).push(window);
        takenKeys.add(dotKey(state.agent.id, window.id));
        freeCount -= 1;
    };
    const orderedWindows = (state) =>
        state.agent.automaticDotOrder
            .map((windowId) => state.lastSnapshot.windows.find((window) => window.id === windowId))
            .filter(Boolean);

    const share = Math.floor(maxDots / connected.length);
    for (const state of connected) {
        for (const window of orderedWindows(state).slice(0, share)) take(state, window);
    }
    for (const state of connected) {
        for (const window of orderedWindows(state)) {
            if (freeCount <= 0) return placed;
            if (!takenKeys.has(dotKey(state.agent.id, window.id))) take(state, window);
        }
    }
    return placed;
}

/**
 * Which windows get the status bar's dots, among the agents with a reading, in settings order: exactly the checked
 * ones when any dot is checked, otherwise automatic placement.
 * @param {{ states: object[], checkedKeys: string[], maxDots: number }} input  `checkedKeys`: the checked dot keys
 * @returns {Map<string, object[]>} per agent id with a reading, its windows to show
 */
function placeDots({ states, checkedKeys, maxDots }) {
    const connected = states.filter((state) => state.lastSnapshot !== undefined);
    const placed = new Map(connected.map((state) => [state.agent.id, []]));
    if (connected.length === 0 || maxDots < 1) return placed;
    if (checkedKeys.length > 0) return placeCheckedDots(connected, checkedKeys, maxDots, placed);
    return placeAutomaticDots(connected, maxDots, placed);
}

/** The dot keys of placed windows, in status bar order. */
function placedDotKeys(placed) {
    return [...placed].flatMap(([agentId, windows]) => windows.map((window) => dotKey(agentId, window.id)));
}

function dotText(window, isAgentNameShown) {
    const label = isAgentNameShown ? window.label : (window.compactLabel ?? window.label);
    return `${usageSignal(window.usedPercent)} ${label} ${Math.round(window.usedPercent)}%`;
}

/**
 * `$(sparkle) Claude 🟢 5h 4% · 🟢 Weekly 75% | $(rocket) Antigravity 🟢 Gemini 5h 8%`, or without names
 * `$(sparkle) 🟢 5h 4% · 🟢 Weekly 75% | $(rocket) 🟢 $(google-gemini) 5h 8%`, where a window's compact label replaces
 * its model names with icons; `$(warning)` marks a failed last read.
 * @param {{ isAgentNameShown: boolean }} options
 */
function buildStatusText(states, placed, { isAgentNameShown }) {
    const segments = [];
    for (const state of states) {
        const windows = placed.get(state.agent.id) ?? [];
        if (windows.length === 0) continue;
        const name = isAgentNameShown ? ` ${state.agent.statusBarName}` : '';
        const warning = hasFailedRead(state) ? ' $(warning)' : '';
        const dots = windows.map((window) => dotText(window, isAgentNameShown)).join(' · ');
        segments.push(`$(${state.agent.icon})${name}${warning} ${dots}`);
    }
    if (segments.length > 0) return segments.join(SEGMENT_SEPARATOR);
    return states.some(hasFailedRead) ? '$(pulse) AgentUsage $(warning)' : '$(pulse) AgentUsage';
}

function nextTryText(backoff, nowMs) {
    const waitMs = (backoff?.nextAllowedMs ?? 0) - nowMs;
    return waitMs > 0 ? `next try in ${formatRemaining(waitMs)}` : 'next try at the next refresh';
}

function failureLine(state, nowMs) {
    const result = state.lastResult;
    if (result === undefined || result.isOk) return undefined;
    const cli = `\`${state.agent.cliCommand}\``;
    switch (result.reason) {
        case 'token-expired':
            return `⚠ Token expired. Run ${cli} once to renew it.`;
        case 'rate-limited':
            return `⚠ The usage API answered 429; ${nextTryText(state.backoff, nowMs)}.`;
        case 'error':
            return `⚠ Read failed: ${escapeMarkdown(result.detail ?? 'unknown error')}; ${nextTryText(state.backoff, nowMs)}.`;
        default:
            return `⚠ Not connected${result.detail ? ` (${escapeMarkdown(result.detail)})` : ''}. Run ${cli} and sign in.`;
    }
}

function agentBlock(state, now) {
    const snapshot = state.lastSnapshot;
    const plan = snapshot?.plan ? ` · ${escapeMarkdown(snapshot.plan)}` : '';
    const lines = [`**$(${state.agent.icon}) ${state.agent.displayName}**${plan}`];
    if (snapshot) {
        if (snapshot.windows.length > 0) {
            lines.push('', '| | Window | Used | Resets |', '|:-:|:--|:--|:--|');
            for (const window of snapshot.windows) {
                const resets = window.resetsAt
                    ? `in ${formatRemaining(window.resetsAt.getTime() - now.getTime())} · ${formatClock(window.resetsAt)}`
                    : '';
                const used = `${renderBar(window.usedPercent)} ${Math.round(window.usedPercent)}%`;
                lines.push(`| ${usageSignal(window.usedPercent)} | ${escapeMarkdown(window.label)} | ${used} | ${resets} |`);
            }
        } else {
            lines.push('', 'No limits reported.');
        }
        for (const window of snapshot.windows) {
            if (!window.breakdown?.length) continue;
            const shares = window.breakdown.map((share) => `${escapeMarkdown(share.label)} ${Math.round(share.usedPercent)}%`);
            lines.push('', `${escapeMarkdown(window.label)}: ${shares.join(' · ')}`);
        }
        for (const note of snapshot.notes ?? []) lines.push('', escapeMarkdown(note));
        lines.push('', `Updated ${formatTime(snapshot.fetchedAt)} · ${formatAge(now.getTime() - snapshot.fetchedAt.getTime())}`);
    }
    const failure = failureLine(state, now.getTime());
    if (failure) lines.push('', failure);
    return lines.join('\n');
}

function notConnectedText(state) {
    const detail = state.lastResult?.detail;
    return detail
        ? `${state.agent.displayName} (${escapeMarkdown(detail)})`
        : `${state.agent.displayName} (run \`${state.agent.cliCommand}\` and sign in)`;
}

/**
 * The hover: one block per agent with a reading or a failed read, then the agents not connected, then the agents
 * not read yet, then the command links.
 * @param {{
 *   states: object[],
 *   now: Date,
 *   commandIds: { refresh: string, openSettings: string, chooseStatusBarDots: string, showLog: string },
 * }} input
 */
function buildHoverMarkdown({ states, now, commandIds }) {
    const blocks = [];
    const notConnected = [];
    const notReadYet = [];
    for (const state of states) {
        if (state.lastSnapshot !== undefined || hasFailedRead(state)) blocks.push(agentBlock(state, now));
        else if (state.lastResult === undefined) notReadYet.push(state.agent.displayName);
        else notConnected.push(state);
    }
    if (notConnected.length > 0) blocks.push(`**Not connected:** ${notConnected.map(notConnectedText).join(' · ')}`);
    if (notReadYet.length > 0) blocks.push(`Reading ${notReadYet.join(', ')}…`);
    if (states.length === 0) blocks.push('No agent is enabled in `agentUsage.agents`.');
    blocks.push(
        [
            `[$(refresh) Refresh](command:${commandIds.refresh})`,
            `[$(gear) Settings](command:${commandIds.openSettings})`,
            `[$(checklist) Status bar dots](command:${commandIds.chooseStatusBarDots})`,
            `[$(output) Log](command:${commandIds.showLog})`,
        ].join(' · '),
    );
    return blocks.join('\n\n---\n\n');
}

/**
 * The dot checklist: every window with a reading, grouped by agent, each checked when its key is in `checkedKeys`.
 * Checked keys that no reading offers follow under "No reading now", still checked, so accepting keeps them.
 * @param {{ states: object[], checkedKeys: string[], now: Date }} input
 * @returns {({ isSeparator: true, label: string } | { label: string, description: string, value: string, isPicked: boolean })[]}
 */
function buildDotPickerEntries({ states, checkedKeys, now }) {
    const checked = new Set(checkedKeys);
    const offeredKeys = new Set();
    const entries = [];
    for (const state of states) {
        const windows = state.lastSnapshot?.windows ?? [];
        if (windows.length === 0) continue;
        entries.push({ isSeparator: true, label: state.agent.displayName });
        for (const window of windows) {
            const key = dotKey(state.agent.id, window.id);
            offeredKeys.add(key);
            const resets = window.resetsAt ? ` · resets in ${formatRemaining(window.resetsAt.getTime() - now.getTime())}` : '';
            entries.push({
                label: `${usageSignal(window.usedPercent)} ${window.label}`,
                description: `${Math.round(window.usedPercent)}%${resets}`,
                value: key,
                isPicked: checked.has(key),
            });
        }
    }
    const unreadKeys = [...checked].filter((key) => !offeredKeys.has(key));
    if (unreadKeys.length > 0) {
        entries.push({ isSeparator: true, label: 'No reading now' });
        for (const key of unreadKeys) entries.push({ label: key, description: 'stays checked until unchecked', value: key, isPicked: true });
    }
    return entries;
}

module.exports = {
    usageSignal,
    renderBar,
    formatRemaining,
    formatAge,
    formatClock,
    placeDots,
    placedDotKeys,
    buildStatusText,
    buildHoverMarkdown,
    buildDotPickerEntries,
};
