'use strict';
/**
 * A child process that speaks newline-delimited JSON-RPC 2.0 on its stdio, as `codex app-server` and
 * `grok agent stdio` do. It starts with `windowsHide`, so Windows opens no console window for it; a request fails after
 * its timeout; `close()` ends stdin and waits for the process to exit by itself, stopping it only after a grace period.
 */
const { spawn } = require('node:child_process');

const STDERR_LINES_KEPT = 5;

/**
 * @param {object} options
 * @param {string} options.command      a name on PATH or a full path
 * @param {readonly string[]} options.args
 * @param {string} options.processName  names the process in errors and log lines, such as `codex app-server`
 * @param {object} options.log          the calling feature's module log
 * @param {number} options.exitGraceMs  how long `close()` waits before stopping the process
 * @param {object} [options.env]        environment variables; the extension host's when absent
 * @param {string} [options.cwd]
 * @returns {{ started: Promise<Error | undefined>, request: (method: string, params: object, timeoutMs: number) => Promise<any>,
 *   notify: (method: string, params: object) => void, close: () => Promise<void>, stderrTail: string[] }}
 *   `started` answers undefined once the process runs, or the spawn error (`code` `ENOENT` when the command is missing).
 */
function startJsonRpcProcess({ command, args, processName, log, exitGraceMs, env, cwd }) {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env, cwd });
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
        rejectPending(new Error(`${processName} exited (code ${code}, signal ${signal ?? 'none'}) before answering`));
    });
    child.stdin.on('error', (error) => rejectPending(new Error(`writing to ${processName} failed: ${error.message}`)));

    function handleLine(line) {
        let message;
        try {
            message = JSON.parse(line);
        } catch (error) {
            log.warn(`${processName} printed a line that is not JSON (${error.name}):`, line.slice(0, 200));
            return;
        }
        if (message.id === undefined || !pending.has(message.id)) {
            log.trace(`${processName} notification:`, message.method ?? '(no method)');
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
                reject(new Error(`${processName} did not answer ${method} within ${timeoutMs / 1000} s`));
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

    async function close() {
        child.stdin.end();
        let graceTimer;
        const graceOver = new Promise((resolve) => {
            graceTimer = setTimeout(resolve, exitGraceMs);
        });
        const outcome = await Promise.race([exited, graceOver]);
        clearTimeout(graceTimer);
        if (outcome === undefined) {
            log.warn(`${processName} still running ${exitGraceMs / 1000} s after stdin closed; stopping it`);
            child.kill('SIGTERM');
        }
    }

    return { started, request, notify, close, stderrTail };
}

module.exports = { startJsonRpcProcess };
