'use strict';
// Usage: node tools/cli-login-times.js codex|grok
// Print only the expiry/refresh timestamps of Codex's and Grok's stored logins (never a token).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function jwtExpiry(jwt) {
    const payload = JSON.parse(Buffer.from(String(jwt).split('.')[1] ?? '', 'base64url').toString('utf8'));
    return new Date(payload.exp * 1000).toISOString();
}

function codexState() {
    const file = path.join(os.homedir(), '.codex', 'auth.json');
    const stat = fs.statSync(file);
    const auth = JSON.parse(fs.readFileSync(file, 'utf8'));
    let accessExpiry;
    try {
        accessExpiry = auth.tokens?.access_token ? jwtExpiry(auth.tokens.access_token) : 'none';
    } catch (error) {
        accessExpiry = `unreadable (${error.name})`;
    }
    return { file: 'codex auth.json', modified: stat.mtime.toISOString(), last_refresh: auth.last_refresh, access_token_expires: accessExpiry };
}

function grokState() {
    const file = path.join(os.homedir(), '.grok', 'auth.json');
    const stat = fs.statSync(file);
    const auth = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sessions = Object.values(auth).map((entry) => ({ create_time: entry.create_time, expires_at: entry.expires_at }));
    return { file: 'grok auth.json', modified: stat.mtime.toISOString(), sessions };
}

const which = process.argv[2];
const states = { codex: codexState, grok: grokState };
console.log(JSON.stringify({ now: new Date().toISOString(), ...states[which]() }));
