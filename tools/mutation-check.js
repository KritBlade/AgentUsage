'use strict';
/**
 * Breaks one rule at a time in the source, runs the tests, and reports whether a test failed. The file is restored
 * after each run, even when the run throws.
 * Usage: node tools/mutation-check.js
 * A mutant whose text is no longer found once, exactly, is reported as not applied: update its text to the code.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DISPLAY = 'src/features/usage-display/usage-display-core.js';
const CHOICE = 'src/features/usage-display/dot-choice.js';
const SETTINGS = 'src/vscode/settings.js';
const POLLING = 'src/features/usage-polling/usage-polling-core.js';
const CLAUDE = 'src/features/claude-usage/claude-usage-core.js';

/** [what the mutant breaks, file, text to replace, replacement] */
const MUTANTS = [
    ['checked dots: the checked filter', DISPLAY, '            if (!checked.has(dotKey(state.agent.id, window.id))) continue;\n', ''],
    ['checked dots: the limit', DISPLAY, '            if (freeCount <= 0) return placed;\n            if (!checked.has', '            if (!checked.has'],
    ['checked or automatic placement', DISPLAY, 'if (checkedKeys.length > 0) return placeCheckedDots', 'if (checkedKeys.length > 99) return placeCheckedDots'],
    ['automatic: the fair share', DISPLAY, 'Math.floor(maxDots / connected.length)', 'Math.ceil(maxDots / connected.length)'],
    ['names hidden (D15)', DISPLAY, "isAgentNameShown ? ` ${state.agent.statusBarName}` : ''", '` ${state.agent.statusBarName}`'],
    ['the separator between agents', DISPLAY, "const SEGMENT_SEPARATOR = '\\u2002|\\u2002';", "const SEGMENT_SEPARATOR = ' | ';"],
    ['names hidden: compact labels (D20)', DISPLAY, 'isAgentNameShown ? window.label : (window.compactLabel ?? window.label)', 'window.label'],
    ["agy's compact labels", 'src/features/antigravity-usage/antigravity-usage-core.js', 'if (compactLabel) window.compactLabel', 'if (false) window.compactLabel'],
    ['the hover Settings link (D14)', DISPLAY, '            `[$(gear) Settings](command:${commandIds.openSettings})`,\n', ''],
    ['checklist: the No reading now group', DISPLAY, '    if (unreadKeys.length > 0) {', '    if (unreadKeys.length > 99) {'],
    ['the 80% colour (D3)', DISPLAY, "if (percent >= WARNING_PERCENT) return '🟡';", "if (percent > WARNING_PERCENT) return '🟡';"],
    ['not connected is no failure', DISPLAY, " && state.lastResult.reason !== 'not-connected'", ''],
    ['choice: unchanged automatic placement saves nothing', CHOICE, '    if (isAutomatic && hasSameKeys(picked, placedKeys)) return;\n', ''],
    ['choice: checked keys listed when not automatic', CHOICE, 'checkedKeys: isAutomatic ? placedKeys : settings.checkedDotKeys', 'checkedKeys: placedKeys'],
    ['choice: the over-limit notice', CHOICE, 'if (picked.length > maxDots) {', 'if (picked.length > maxDots + 1) {'],
    ['settings: saving none removes the setting', SETTINGS, ': undefined;\n    return configuration().update', ': {};\n    return configuration().update'],
    ['settings: only true checkboxes count', SETTINGS, '.filter((key) => statusBarDots[key] === true)', ''],
    ['settings: the page filter', SETTINGS, '`@ext:${extensionId}`', 'extensionId'],
    ['package.json: reads every 60 s (D16)', 'package.json', '"default": 60,', '"default": 300,'],
    ['Codex automatic order', 'src/features/codex-usage/index.js', "['session', 'weekly']", "['weekly', 'session']"],
    ['the click opens the popup (D17)', 'src/index.js', 'createStatusBar({ commandId: COMMAND_IDS.showUsagePopup,', 'createStatusBar({ commandId: COMMAND_IDS.refresh,'],
    ['the popup command hidden from the palette', 'package.json', '"when": "false"', '"when": "true"'],
    ['a popup link closes the popup', 'src/index.js', '            statusBar.closePopup();\n            return handler();', '            return handler();'],
    ['closing the popup drops the entry', 'src/vscode/status-bar.js', '            item.hide();\n            item.show();', '            item.show();'],
    ['backoff doubling', POLLING, 'previous.failMs * 2', 'previous.failMs * 3'],
    ['a forced read never cuts a rate limit', POLLING, 'return isForced && !isRateLimited;', 'return isForced;'],
    ["Grok's expiry check (D9)", 'src/features/grok-usage/grok-usage-core.js', 'session.expiresAt.getTime() <= now.getTime()', 'session.expiresAt.getTime() < now.getTime() - 86400000'],
    ["agy's remaining_fraction inversion", 'src/features/antigravity-usage/antigravity-usage-core.js', 'toUsedPercent((1 - remaining) * 100)', 'toUsedPercent(remaining * 100)'],
    ["agy's auto-update off for the quota read", 'src/features/antigravity-usage/antigravity-usage-core.js', "[AUTO_UPDATE_OFF_VARIABLE]: 'true'", "[AUTO_UPDATE_OFF_VARIABLE]: 'false'"],
    ['the keychain account rule', CLAUDE, 'PLAIN_ACCOUNT_NAME.test(name) ? name', 'name ? name'],
    ["Codex's weekly by length (D4)", 'src/features/codex-usage/codex-usage-core.js', 'minutes >= WEEKLY_MIN_MINUTES', 'minutes > 999999'],
    ["Claude's model windows", CLAUDE, "if (item?.kind !== 'weekly_scoped') continue;", "if (item?.kind !== 'weekly_all') continue;"],
    ['credentials text kept out of the log', 'src/shared/credentials-file.js', '(${error.name}; message withheld', '(${error.message}; message withheld'],
];

function testsFail() {
    const run = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { cwd: ROOT, encoding: 'utf8' });
    if (run.error) throw run.error;
    return run.status !== 0;
}

function main() {
    if (testsFail()) {
        process.stdout.write('The tests fail before any mutant; fix them first.\n');
        return 1;
    }
    const notCaught = [];
    for (const [rule, relativePath, lfOriginal, lfReplacement] of MUTANTS) {
        const filePath = path.join(ROOT, relativePath);
        const text = fs.readFileSync(filePath, 'utf8');
        // Git checks files out with CRLF on Windows, so a mutant's line breaks follow the file's own.
        const lineBreak = text.includes('\r\n') ? '\r\n' : '\n';
        const original = lfOriginal.replaceAll('\n', lineBreak);
        const replacement = lfReplacement.replaceAll('\n', lineBreak);
        const occurrences = text.split(original).length - 1;
        if (occurrences !== 1) {
            process.stdout.write(`NOT APPLIED  ${rule}: its text occurs ${occurrences} times in ${relativePath}\n`);
            notCaught.push(rule);
            continue;
        }
        let isCaught;
        try {
            fs.writeFileSync(filePath, text.replace(original, () => replacement));
            isCaught = testsFail();
        } finally {
            fs.writeFileSync(filePath, text);
        }
        process.stdout.write(`${isCaught ? 'caught      ' : 'NOT CAUGHT  '} ${rule}\n`);
        if (!isCaught) notCaught.push(rule);
    }
    process.stdout.write(`${MUTANTS.length - notCaught.length} of ${MUTANTS.length} caught\n`);
    return notCaught.length === 0 ? 0 : 1;
}

process.exitCode = main();
