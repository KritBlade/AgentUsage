'use strict';
/**
 * Reads Codex's usage through its own app-server: `codex -s read-only -a never app-server` speaks newline-delimited
 * JSON-RPC on stdio. Codex reads its login from whichever store it uses and renews its own token, so AgentUsage never
 * touches a Codex token. After the read, stdin is closed and Codex exits by itself.
 */
const { spawn } = require('node:child_process');
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure, errorDetail } = require('../../shared/usage-window.js');
const { parseCodexRateLimits } = require('./codex-usage-core.js');

const log = createModuleLog('codex-usage');
const APP_SERVER_ARGS = Object.freeze(['-s', 'read-only', '-a', 'never', 'app-server']);
const CLIENT_INFO = Object.freeze({ name: 'agent-usage', version: '0.1.0' });
const INITIALIZE_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const EXIT_GRACE_MS = 10_000;
const STDERR_LINES_KEPT = 5;

/** Starts the app-server and answers a small JSON-RPC session over its stdio. */
function openAppServer(command) {
    const child = spawn(command, APP_SERVER_ARGS, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const pending = new Map();
    const stderrTail = [];
    let nextId = 1;
    let buffered = '';

    const started = new Promise((resolve) => {
        child.once('spawn', () => resolve(undefined));
        child.once('error', (error) => resolve(error));
    });
    const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

    function rejectPending(error) {
        for (const { reject } of pending.values()) reject(error);
        pending.clear();
    }

    child.once('exit', (code, signal) => {
        rejectPending(new Error(`codex app-server exited (code ${code}, signal ${signal ?? 'none'}) before answering`));
    });
    child.stdin.on('error', (error) => rejectPending(new Error(`writing to codex app-server failed: ${error.message}`)));

    function handleLine(line) {
        let message;
        try {
            message = JSON.parse(line);
        } catch (error) {
            log.warn(`codex app-server printed a line that is not JSON (${error.name}):`, line.slice(0, 200));
            return;
        }
        if (message.id === undefined || !pending.has(message.id)) {
            log.trace('codex app-server notification:', message.method ?? '(no method)');
            return;
        }
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(String(message.error.message ?? JSON.stringify(message.error))));
        else resolve(message.result);
    }

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        buffered += chunk;
        let newline;
        while ((newline = buffered.indexOf('\n')) >= 0) {
            const line = buffered.slice(0, newline).trim();
            buffered = buffered.slice(newline + 1);
            if (line) handleLine(line);
        }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderrTail.push(...chunk.split('\n').filter(Boolean));
        stderrTail.splice(0, Math.max(0, stderrTail.length - STDERR_LINES_KEPT));
    });

    function send(payload) {
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...payload })}\n`);
    }

    function request(method, params, timeoutMs) {
        const id = nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(id);
                reject(new Error(`codex app-server did not answer ${method} within ${timeoutMs / 1000} s`));
            }, timeoutMs);
            pending.set(id, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                },
            });
            send({ id, method, params });
        });
    }

    function notify(method, params) {
        send({ method, params });
    }

    /** Closes stdin and waits for Codex to exit by itself; stops it only if it is still running after the grace period. */
    async function close() {
        child.stdin.end();
        let graceTimer;
        const graceOver = new Promise((resolve) => {
            graceTimer = setTimeout(resolve, EXIT_GRACE_MS);
        });
        const outcome = await Promise.race([exited, graceOver]);
        clearTimeout(graceTimer);
        if (outcome === undefined) {
            log.warn(`codex app-server still running ${EXIT_GRACE_MS / 1000} s after stdin closed; stopping it`);
            child.kill('SIGTERM');
        }
    }

    return { started, request, notify, close, stderrTail };
}

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
async function readCodexUsage({ codexCommand }) {
    const session = openAppServer(codexCommand);
    const startError = await session.started;
    if (startError) {
        if (startError.code === 'ENOENT') {
            // EXPECTED: Codex is not installed, or not on VS Code's PATH.
            log.verbose(`${codexCommand} not found`);
            return usageFailure('not-connected', `${codexCommand} not found`);
        }
        log.warn(`cannot start ${codexCommand} app-server:`, startError);
        return usageFailure('error', errorDetail(startError));
    }
    try {
        await session.request('initialize', { clientInfo: CLIENT_INFO }, INITIALIZE_TIMEOUT_MS);
        session.notify('initialized', {});
        const result = await session.request('account/rateLimits/read', {}, REQUEST_TIMEOUT_MS);
        log.trace('rate limits:', result);
        const { snapshot, droppedWindows } = parseCodexRateLimits(result, new Date());
        if (droppedWindows.length > 0) log.warn(`dropped Codex windows: ${droppedWindows.join('; ')}`);
        log.verbose(`read ${snapshot.windows.length} windows`);
        return { isOk: true, snapshot };
    } catch (error) {
        const stderr = session.stderrTail.join(' | ').slice(0, 300);
        log.warn('codex app-server read failed:', error, stderr ? `(stderr: ${stderr})` : '');
        return usageFailure('error', error instanceof Error ? error.message : String(error));
    } finally {
        await session.close();
    }
}

module.exports = { readCodexUsage };
