'use strict';
/**
 * agy's `/quota` answer (`agy -p /quota --output-format json`), as pure functions: model groups, each with a 5-hour
 * and a weekly bucket that give the fraction remaining.
 */
const { toUsedPercent, parseIsoResetTime } = require('../../shared/usage-window.js');

const WINDOW_LABELS = Object.freeze({ '5h': '5h', weekly: 'Weekly' });
const WINDOW_ORDER = Object.freeze({ '5h': 0, weekly: 1 });
const UNKNOWN_WINDOW_ORDER = 9;

/** "Gemini Models" reads as "Gemini", "Claude and GPT models" as "Claude and GPT". */
function groupLabel(name) {
    return name.replace(/\s+models$/i, '').trim();
}

function firstLine(text) {
    return String(text).trim().split('\n')[0] ?? '';
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
            const window = { id: bucket.id, label: `${label} ${WINDOW_LABELS[bucket.window] ?? bucket.name ?? bucket.window}`, usedPercent };
            if (reset.resetsAt) window.resetsAt = reset.resetsAt;
            windows.push(window);
        }
    }
    return { snapshot: { agentId: 'antigravity', windows, fetchedAt }, droppedBuckets };
}

module.exports = { parseAntigravityQuota };
