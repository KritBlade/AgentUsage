'use strict';
/**
 * The macOS login keychain, read through /usr/bin/security.
 * Neither the secret nor `security`'s stderr is logged: stderr can echo item data.
 */
const { execFile } = require('node:child_process');
const { createModuleLog } = require('../shared/log.js');

const log = createModuleLog('keychain');
const SECURITY_BINARY = '/usr/bin/security';
const ITEM_NOT_FOUND_EXIT_CODE = 44;
const KEYCHAIN_TIMEOUT_MS = 10_000;

/**
 * Reads one generic password.
 * @param {{ service: string, account?: string }} item
 * @returns {Promise<{ state: 'found', secret: string } | { state: 'missing' } | { state: 'failed' }>}
 */
function readGenericPassword({ service, account }) {
    const args = ['find-generic-password'];
    if (account) args.push('-a', account);
    args.push('-s', service, '-w');
    return new Promise((resolve) => {
        execFile(
            SECURITY_BINARY,
            args,
            { timeout: KEYCHAIN_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 1024 * 1024 },
            (error, stdout) => {
                if (!error) {
                    resolve({ state: 'found', secret: stdout.trim() });
                    return;
                }
                if (error.code === ITEM_NOT_FOUND_EXIT_CODE) {
                    // EXPECTED: no item means the CLI has not signed in on this Mac.
                    log.verbose(`no keychain item "${service}"`);
                    resolve({ state: 'missing' });
                    return;
                }
                log.warn(
                    `reading keychain item "${service}" failed (exit code ${error.code}, signal ${error.signal ?? 'none'}; ` +
                        'stderr withheld because it can echo item data)',
                );
                resolve({ state: 'failed' });
            },
        );
    });
}

module.exports = { readGenericPassword };
