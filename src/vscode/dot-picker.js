'use strict';
/** The dot checklist's editor side: a multi-select quick pick, and a notice. */
const vscode = require('vscode');

/**
 * Shows the checklist; answers the checked entries' values, or undefined when the user pressed Escape.
 * @param {({ isSeparator: true, label: string } | { label: string, description?: string, value: string, isPicked: boolean })[]} entries
 */
async function pickMany(entries, { title, placeHolder }) {
    const items = entries.map((entry) =>
        entry.isSeparator
            ? { label: entry.label, kind: vscode.QuickPickItemKind.Separator }
            : { label: entry.label, description: entry.description, picked: entry.isPicked, value: entry.value },
    );
    const picked = await vscode.window.showQuickPick(items, { title, placeHolder, canPickMany: true, matchOnDescription: true });
    return picked?.map((item) => item.value);
}

function showNotice(message) {
    void vscode.window.showInformationMessage(message);
}

module.exports = { pickMany, showNotice };
