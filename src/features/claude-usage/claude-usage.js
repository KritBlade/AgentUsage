'use strict';
/** Reads Claude Code's usage: its OAuth token from where Claude Code keeps it on this OS, then the usage endpoint. */
const fs = require('node:fs/promises');
const os = require('node:os');
const { createModuleLog } = require('../../shared/log.js');
const { usageFailure } = require('../../shared/usage-window.js');
const { fetchUsageJson } = require('../../shared/usage-http.js');
const { readCredentialsFile, parseCredentialsText } = require('../../shared/credentials-file.js');
const { readGenericPassword } = require('../../macos/keychain.js');
const { readGenericCredentials } = require('../../windows/credential-manager.js');
const core = require('./claude-usage-core.js');

const log = createModuleLog('claude-usage');
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
/** Claude Code's own client string; this endpoint throttles unknown clients harder. */
const USER_AGENT = 'claude-code/2.1.90';

/** The OS user name for the keychain account; Claude Code uses `claude-code-user` when it cannot be read. */
function readOsUserName() {
    try {
        return os.userInfo().username;
    } catch (error) {
        log.warn('cannot read the OS user name, so the keychain account is claude-code-user, as in Claude Code:', error);
        return undefined;
    }
}

function credentialsFromJson(json, sourceName) {
    const { accessToken, plan } = core.parseClaudeCredentials(json);
    if (!accessToken) {
        log.verbose(`${sourceName} holds no OAuth token`);
        return { state: 'missing' };
    }
    return { state: 'found', accessToken, plan };
}

function credentialsFromText(text, sourceName) {
    const parsed = parseCredentialsText(text, sourceName, log);
    return parsed.state === 'found' ? credentialsFromJson(parsed.json, sourceName) : parsed;
}

/** Claude Code's rollout check; an unreadable settings file reads as off, as it does in Claude Code. */
async function isCredentialManagerInUse(homedir, env) {
    if (core.isCredentialManagerEnabled(env, undefined)) return true;
    const { legacyPath, configPath } = core.claudeSettingsFilePaths(homedir, env);
    for (const filePath of [legacyPath, configPath]) {
        let text;
        try {
            text = await fs.readFile(filePath, 'utf8');
        } catch (error) {
            // EXPECTED: Claude Code reads the legacy file only when it exists, then the main one.
            if (error?.code === 'ENOENT') continue;
            log.warn(`cannot read ${filePath}, so Credential Manager reads as off, as in Claude Code:`, error);
            return false;
        }
        try {
            return core.isCredentialManagerEnabled(env, JSON.parse(text));
        } catch (error) {
            log.warn(`${filePath} is not valid JSON (${error.name}), so Credential Manager reads as off, as in Claude Code`);
            return false;
        }
    }
    return false;
}

/** The blob from Credential Manager, joined when Claude Code stored it in chunks. */
async function readCredentialManagerText(homedir, env) {
    const target = core.claudeCredentialManagerTarget(homedir, env);
    const indexTarget = `${target}#m`;
    const first = await readGenericCredentials([target, indexTarget]);
    if (first.state === 'failed') return { state: 'failed' };
    const whole = first.blobs.get(target);
    if (whole) return { state: 'found', text: whole.toString('utf8') };
    const indexBlob = first.blobs.get(indexTarget);
    if (!indexBlob) return { state: 'missing' };
    const chunkIndex = core.parseChunkIndex(indexBlob.toString('utf8'));
    if (chunkIndex.problem) {
        log.warn(`Credential Manager entry ${target}: ${chunkIndex.problem}`);
        return { state: 'failed' };
    }
    const chunkTargets = core.chunkTargetNames(target, chunkIndex.count);
    const chunks = await readGenericCredentials(chunkTargets);
    if (chunks.state === 'failed') return { state: 'failed' };
    const joined = core.joinCredentialChunks(
        chunkIndex,
        chunkTargets.map((name) => chunks.blobs.get(name)?.toString('utf8') ?? null),
    );
    if (joined.problem) {
        log.warn(`Credential Manager entry ${target}: ${joined.problem}`);
        return { state: 'failed' };
    }
    if (!joined.isLengthMatching) log.warn(`Credential Manager entry ${target}: the chunks differ from the recorded length`);
    return { state: 'found', text: joined.text };
}

/**
 * The token, read where Claude Code itself reads it on this OS.
 * @returns {Promise<{ state: 'found', accessToken: string, plan?: string } | { state: 'missing' } | { state: 'failed', failure: object }>}
 */
async function resolveClaudeCredentials({ homedir, env, platform }) {
    const environmentToken = core.claudeEnvironmentToken(env);
    if (environmentToken) return { state: 'found', accessToken: environmentToken };
    if (platform === 'darwin') {
        const item = await readGenericPassword({
            service: core.claudeCredentialsService(homedir, env),
            account: core.claudeKeychainAccount(env, readOsUserName),
        });
        if (item.state === 'found') return credentialsFromText(item.secret, 'the Claude Code keychain item');
        if (item.state === 'failed') return { state: 'failed', failure: usageFailure('error', 'Cannot read the macOS keychain') };
    } else if (platform === 'win32' && (await isCredentialManagerInUse(homedir, env))) {
        const stored = await readCredentialManagerText(homedir, env);
        if (stored.state === 'found') return credentialsFromText(stored.text, 'the Claude Code Credential Manager entry');
        if (stored.state === 'failed') {
            return { state: 'failed', failure: usageFailure('error', 'Cannot read Windows Credential Manager') };
        }
    }
    const filePath = core.claudeCredentialsFilePath(homedir, env);
    const file = await readCredentialsFile(filePath, log);
    return file.state === 'found' ? credentialsFromJson(file.json, filePath) : file;
}

/** @returns {Promise<import('../../shared/usage-window.js').UsageResult>} */
async function readClaudeUsage(environment) {
    const credentials = await resolveClaudeCredentials(environment);
    if (credentials.state === 'missing') return usageFailure('not-connected');
    if (credentials.state === 'failed') return credentials.failure;
    const answer = await fetchUsageJson({
        url: USAGE_URL,
        headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'anthropic-beta': 'oauth-2025-04-20',
            'User-Agent': USER_AGENT,
        },
        log,
    });
    if (!answer.isOk) return answer.failure;
    const snapshot = core.parseClaudeUsage(answer.json, credentials.plan, new Date());
    log.verbose(`read ${snapshot.windows.length} windows`);
    return { isOk: true, snapshot };
}

module.exports = { readClaudeUsage };
