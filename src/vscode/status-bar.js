'use strict';
/** The one AgentUsage status bar item: its text, its markdown hover with command links, and opening that hover. */
const vscode = require('vscode');

/** @param {{ commandId: string, enabledCommandIds: string[] }} options  the click command, and the commands hover links may run */
function createStatusBar({ commandId, enabledCommandIds }) {
    const item = vscode.window.createStatusBarItem('agentUsage.status', vscode.StatusBarAlignment.Right, 0);
    item.name = 'AgentUsage';
    item.command = commandId;
    let isDisposed = false;
    return {
        render(text, hoverMarkdown) {
            if (isDisposed) return;
            item.text = text;
            const tooltip = new vscode.MarkdownString(hoverMarkdown, true);
            tooltip.isTrusted = { enabledCommands: enabledCommandIds };
            item.tooltip = tooltip;
            item.show();
        },
        /**
         * Closes the item's popup if it is open. VS Code drops an entry's hover with the entry and offers extensions no
         * other way, so the item is hidden and shown again: `hide()` removes the entry at once and `show()` adds it back
         * on the next tick, in the same place, because extension entries are ordered by priority and extension id.
         */
        closePopup() {
            if (isDisposed) return;
            item.hide();
            item.show();
        },
        dispose() {
            isDisposed = true;
            item.dispose();
        },
    };
}

/**
 * Opens the focused element's hover at once. Run as the item's click command: the click leaves the item focused, so
 * VS Code's `workbench.action.showHover` opens the item's own hover without `workbench.hover.delay`.
 */
function showFocusedHover() {
    return vscode.commands.executeCommand('workbench.action.showHover');
}

module.exports = { createStatusBar, showFocusedHover };
