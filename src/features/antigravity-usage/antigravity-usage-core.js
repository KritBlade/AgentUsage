'use strict';
/**
 * agy's `/quota` read (`agy -p /quota --output-format json`), as pure functions: the environment it runs with, and its
 * answer: model groups, each with a 5-hour and a weekly bucket that give the fraction remaining.
 */
const { toUsedPercent, parseIsoResetTime } = require('../../shared/usage-window.js');

/**
 * About every 15 minutes an agy run starts agy's background updater (`agy --bg-updater`), which runs `agy --version` in
 * a new console window. On Windows that window flashes on the desktop: `windowsHide` on AgentUsage's call does not
 * reach it.
 * With this variable set, the run skips the update check. agy still updates itself when the user runs it.
 */
const AUTO_UPDATE_OFF_VARIABLE = 'AGY_CLI_DISABLE_AUTO_UPDATE';
const WINDOW_LABELS = Object.freeze({ '5h': '5h', weekly: 'Weekly' });
const WINDOW_ORDER = Object.freeze({ '5h': 0, weekly: 1 });
const UNKNOWN_WINDOW_ORDER = 9;
/** VS Code's brand codicons (from VS Code 1.131) that replace a group's leading model names in a compact label. */
const GROUP_ICONS = Object.freeze([
    Object.freeze({ namePattern: /^Gemini\b/, icons: '$(google-gemini)' }),
    Object.freeze({ namePattern: /^Claude and GPT\b/, icons: '$(claude)$(openai)' }),
]);

/** "Gemini Models" reads as "Gemini", "Claude and GPT models" as "Claude and GPT". */
function groupLabel(name) {
    return name.replace(/\s+models$/i, '').trim();
}

/** "Gemini" reads as `$(google-gemini)`, "Gemini 4 Argon" as `$(google-gemini) 4 Argon`; a group without an icon gives undefined. */
function groupCompactLabel(label) {
    const match = GROUP_ICONS.find(({ namePattern }) => namePattern.test(label));
    if (!match) return undefined;
    const rest = label.replace(match.namePattern, '').trim();
    return rest ? `${match.icons} ${rest}` : match.icons;
}

function firstLine(text) {
    return String(text).trim().split('\n')[0] ?? '';
}

/** The environment variables the quota read runs with: the given ones, with agy's auto-update turned off. */
function quotaEnvironmentVariables(environmentVariables) {
    return { ...environmentVariables, [AUTO_UPDATE_OFF_VARIABLE]: 'true' };
}

/**
 * @returns {{ snapshot: import('../../shared/usage-window.js').UsageSnapshot, droppedBuckets: string[] } | { problem: string }}
 */
function parseAntigravityQuota(stdout, fetchedAt) {
    let answer;
    try {
        answer = JSON.parse(stdout);
    } catch (error) {
        return { problem: `agy printed no JSON (${error.name}): ${firstLine(stdout).slice(0, 160)}` };
    }
    if (answer?.status !== 'SUCCESS') {
        const said = typeof answer?.response === 'string' && answer.response.trim() ? answer.response.trim() : `status ${String(answer?.status)}`;
        return { problem: `agy: ${said.slice(0, 300)}` };
    }
    const groups = answer.command?.data?.groups;
    if (!Array.isArray(groups)) return { problem: 'agy answered without quota groups' };
    const windows = [];
    const droppedBuckets = [];
    for (const group of groups) {
        if (typeof group?.name !== 'string' || !Array.isArray(group.buckets)) continue;
        const label = groupLabel(group.name);
        const compactLabel = groupCompactLabel(label);
        const buckets = [...group.buckets].sort(
            (left, right) => (WINDOW_ORDER[left?.window] ?? UNKNOWN_WINDOW_ORDER) - (WINDOW_ORDER[right?.window] ?? UNKNOWN_WINDOW_ORDER),
        );
        for (const bucket of buckets) {
            const remaining = bucket?.remaining_fraction;
            const usedPercent = typeof remaining === 'number' ? toUsedPercent((1 - remaining) * 100) : undefined;
            const reset = parseIsoResetTime(bucket?.reset_time);
            if (typeof bucket?.id !== 'string' || bucket.id.length === 0 || usedPercent === undefined || !reset.isValid) {
                droppedBuckets.push(String(bucket?.id ?? '(no id)'));
                continue;
            }
            const windowLabel = WINDOW_LABELS[bucket.window] ?? bucket.name ?? bucket.window;
            const window = { id: bucket.id, label: `${label} ${windowLabel}`, usedPercent };
            if (compactLabel) window.compactLabel = `${compactLabel} ${windowLabel}`;
            if (reset.resetsAt) window.resetsAt = reset.resetsAt;
            windows.push(window);
        }
    }
    return { snapshot: { agentId: 'antigravity', windows, fetchedAt }, droppedBuckets };
}

module.exports = { parseAntigravityQuota, quotaEnvironmentVariables };
