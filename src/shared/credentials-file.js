'use strict';
/**
 * A CLI's JSON credentials, read from a file or handed over as text.
 * Answers `{ state: 'found', json }`, `{ state: 'missing' }` when the file does not exist (the CLI has not signed in
 * here), or `{ state: 'failed', failure }` when it exists but cannot be read or parsed.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { usageFailure } = require('./usage-window.js');

/**
 * Parses credentials text. JSON.parse's own message quotes the text it failed on, and that text holds the token,
 * so only the error's name is logged.
 * @param {string} text
 * @param {string} sourceName  the file path or store name, for the log and the detail
 */
function parseCredentialsText(text, sourceName, log) {
    try {
        return { state: 'found', json: JSON.parse(text) };
    } catch (error) {
        log.warn(`${sourceName} is not valid JSON (${error.name}; message withheld because it quotes the token)`);
        return { state: 'failed', failure: usageFailure('error', `Cannot parse ${path.basename(sourceName)}`) };
    }
}

async function readCredentialsFile(filePath, log) {
    let text;
    try {
        text = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') {
            // EXPECTED: no file means the CLI has not signed in on this machine, or keeps its login elsewhere.
            log.verbose(`no credentials file at ${filePath}`);
            return { state: 'missing' };
        }
        log.warn(`cannot read ${filePath}:`, error);
        return { state: 'failed', failure: usageFailure('error', `Cannot read ${path.basename(filePath)}`) };
    }
    return parseCredentialsText(text, filePath, log);
}

module.exports = { readCredentialsFile, parseCredentialsText };
