'use strict';
// Probe a CLI's stdio JSON-RPC server: send the handshake and one read, print the answer with
// identity fields redacted, then close stdin and let the CLI exit on its own (no kill unless it hangs).
// Usage: node tools/cli-rpc-probe.js codex|grok

const { spawn } = require('node:child_process');

const PLANS = {
    codex: {
        command: 'codex',
        args: ['-s', 'read-only', '-a', 'never', 'app-server'],
        steps: [
            { id: 1, method: 'initialize', params: { clientInfo: { name: 'agent-usage-probe', version: '0.0.1' } }, timeoutMs: 20000 },
            { method: 'initialized', params: {} },
            { id: 2, method: 'account/rateLimits/read', params: {}, timeoutMs: 20000 },
        ],
    },
    grok: {
        command: 'grok',
        args: ['agent', 'stdio'],
        steps: [
            {
                id: 1,
                method: 'initialize',
                params: { protocolVersion: '1', clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } },
                timeoutMs: 20000,
            },
            { id: 2, method: '_x.ai/billing', params: {}, timeoutMs: 20000 },
        ],
    },
};

const IDENTITY_KEY = /email|token|key|secret|user_?id|userid|account_?id|team_?id|principal/i;

function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, IDENTITY_KEY.test(k) && typeof v !== 'object' ? '<redacted>' : redact(v)]));
    }
    return value;
}

async function main() {
    const plan = PLANS[process.argv[2]];
    if (!plan) throw new Error('mode must be codex or grok');
    const startedAt = Date.now();
    const child = spawn(plan.command, plan.args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    const stderrTail = [];
    let buffered = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        buffered += chunk;
        let newline;
        while ((newline = buffered.indexOf('\n')) >= 0) {
            const line = buffered.slice(0, newline).trim();
            buffered = buffered.slice(newline + 1);
            if (!line) continue;
            let message;
            try {
                message = JSON.parse(line);
            } catch (error) {
                console.log('non-JSON stdout line:', line.slice(0, 160), `(${error.name})`);
                continue;
            }
            if (message.id !== undefined && pending.has(message.id)) {
                pending.get(message.id)(message);
                pending.delete(message.id);
            } else {
                console.log('notification:', message.method ?? '(no method)');
            }
        }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderrTail.push(...chunk.split('\n').filter(Boolean));
        stderrTail.splice(0, Math.max(0, stderrTail.length - 8));
    });
    const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
    child.on('error', (error) => console.log('spawn error:', error.message));

    for (const step of plan.steps) {
        const payload = { jsonrpc: '2.0', method: step.method, params: step.params };
        if (step.id !== undefined) payload.id = step.id;
        const sentAt = Date.now();
        child.stdin.write(`${JSON.stringify(payload)}\n`);
        if (step.id === undefined) continue;
        const reply = await Promise.race([
            new Promise((resolve) => pending.set(step.id, resolve)),
            new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), step.timeoutMs)),
        ]);
        const elapsed = Date.now() - sentAt;
        if (reply.timedOut) {
            console.log(`${step.method}: no answer after ${elapsed} ms`);
            break;
        }
        console.log(`${step.method}: answered in ${elapsed} ms`);
        console.log(JSON.stringify(redact(reply.error ? { error: reply.error } : reply.result), null, 1).slice(0, 2500));
    }

    child.stdin.end();
    const outcome = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), 30000))]);
    if (outcome === null) {
        console.log('still running 30 s after stdin closed; sending SIGTERM');
        child.kill('SIGTERM');
        console.log('exit:', await exited);
    } else {
        console.log('exited on its own:', outcome);
    }
    console.log(`total ${Date.now() - startedAt} ms`);
    if (stderrTail.length > 0) console.log('stderr tail:\n  ' + stderrTail.map((line) => line.slice(0, 200)).join('\n  '));
}

main().catch((error) => {
    console.log('probe failed:', error);
    process.exitCode = 1;
});
