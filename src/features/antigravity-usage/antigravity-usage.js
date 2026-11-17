'use strict';
/**
 * Reads Antigravity's usage by running agy's read-only `/quota` command in print mode. agy signs itself in, so
 * AgentUsage reads no Antigravity token. `--log-file` points at the null device so polling leaves no log files.
 */
const { execFile } = require('node:child_process');
const os = require('node:os');
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure } = require('../../shared/usage-window.js');
const { parseAntigravityQuota } = require('./antigravity-usage-core.js');

const log = createModuleLog('antigravity-usage');
const QUOTA_TIMEOUT_MS = 60_000;

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
function readAntigravityUsage({ antigravityCommand, homedir }) {
    const args = ['-p', '/quota', '--output-format', 'json', '--log-file', os.devNull];
    return new Promise((resolve) => {
        execFile(
            antigravityCommand,
            args,
            { timeout: QUOTA_TIMEOUT_MS, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, cwd: homedir, windowsHide: true },
            (error, stdout, stderr) => {
                if (error?.code === 'ENOENT') {
                    // EXPECTED: agy is not installed, or not on VS Code's PATH.
                    log.verbose(`${antigravityCommand} not found`);
                    resolve(usageFailure('not-connected', `${antigravityCommand} not found`));
                    return;
                }
                if (error) {
                    const said = String(stderr || stdout || '').trim().split('\n')[0]?.slice(0, 200) ?? '';
                    log.warn(
                        `${antigravityCommand} -p /quota failed (exit code ${error.code}, signal ${error.signal ?? 'none'}` +
                            `${error.killed ? ', stopped after the timeout' : ''})${said ? `: ${said}` : ''}`,
                    );
                    resolve(usageFailure('error', said || `agy exited with code ${error.code}`));
                    return;
                }
                const parsed = parseAntigravityQuota(stdout, new Date());
                if (parsed.problem) {
                    log.warn(parsed.problem);
                    resolve(usageFailure('error', parsed.problem));
                    return;
                }
                if (parsed.droppedBuckets.length > 0) log.warn(`dropped Antigravity buckets: ${parsed.droppedBuckets.join(', ')}`);
                log.trace('quota answer:', stdout);
                log.verbose(`read ${parsed.snapshot.windows.length} windows`);
                resolve({ isOk: true, snapshot: parsed.snapshot });
            },
        );
    });
}

module.exports = { readAntigravityUsage };
