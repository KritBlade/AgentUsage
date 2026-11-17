'use strict';
/**
 * The "Choose Status Bar Dots" flow: one checklist of every window with a reading, grouped by agent, with the dots now
 * on the status bar checked. Accepting saves the checked dots to `agentUsage.statusBarDots`; none checked means
 * automatic placement. Editor calls come in as functions, so this file never imports the editor.
 */
const { buildDotPickerEntries, placedDotKeys } = require('./usage-display-core.js');

const TITLE = 'AgentUsage: Choose Status Bar Dots';

function hasSameKeys(left, right) {
    return left.length === right.length && left.every((key) => right.includes(key));
}

/**
 * @param {{
 *   states: object[],
 *   placed: Map<string, object[]>,
 *   settings: { checkedDotKeys: string[], maxStatusBarDots: number },
 *   pickMany: (entries: object[], options: { title: string, placeHolder: string }) => Promise<string[] | undefined>,
 *   showNotice: (message: string) => void,
 *   saveStatusBarDots: (keys: string[]) => Promise<void>,
 *   now: Date,
 * }} context  `placed`: the dots on the status bar now, as placeDots answers them
 */
async function chooseStatusBarDots({ states, placed, settings, pickMany, showNotice, saveStatusBarDots, now }) {
    const isAutomatic = settings.checkedDotKeys.length === 0;
    const placedKeys = placedDotKeys(placed);
    const entries = buildDotPickerEntries({ states, checkedKeys: isAutomatic ? placedKeys : settings.checkedDotKeys, now });
    if (entries.length === 0) {
        showNotice('AgentUsage has no reading yet. Refresh, then choose the dots.');
        return;
    }
    const maxDots = settings.maxStatusBarDots;
    const picked = await pickMany(entries, {
        title: TITLE,
        placeHolder: `Check the dots to show, at most ${maxDots}; check none for automatic placement`,
    });
    if (picked === undefined) return;
    if (isAutomatic && hasSameKeys(picked, placedKeys)) return;
    await saveStatusBarDots(picked);
    if (picked.length > maxDots) {
        showNotice(
            `${picked.length} dots are checked and the status bar shows at most ${maxDots}. ` +
                'Raise Max Status Bar Dots in AgentUsage\'s settings to see them all.',
        );
    }
}

module.exports = { chooseStatusBarDots };
