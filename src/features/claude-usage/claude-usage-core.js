'use strict';
/**
 * Claude Code's credential rules and usage answer, as pure functions.
 *
 * Claude Code keeps one OAuth blob, `{ claudeAiOauth: { accessToken, subscriptionType, rateLimitTier, … } }`:
 * - macOS: the keychain item (service and account below); `.credentials.json` only when no item exists.
 * - Windows: Credential Manager when CLAUDE_CODE_FORCE_WINDOWS_CREDMAN=1 or its settings cache the rollout flag
 *   `tengu_windows_credman`, then the file when Credential Manager holds nothing; otherwise the file.
 * - Elsewhere: the file.
 * CLAUDE_CODE_OAUTH_TOKEN, when set, wins over every store.
 */
const path = require('node:path');
const { createHash } = require('node:crypto');
const { toUsedPercent, parseIsoResetTime } = require('../../shared/usage-window.js');

const TOKEN_ENV_VAR = 'CLAUDE_CODE_OAUTH_TOKEN';
const SECURE_STORAGE_DIR_ENV_VAR = 'CLAUDE_SECURESTORAGE_CONFIG_DIR';
const CONFIG_DIR_ENV_VAR = 'CLAUDE_CONFIG_DIR';
const FORCE_CREDENTIAL_MANAGER_ENV_VAR = 'CLAUDE_CODE_FORCE_WINDOWS_CREDMAN';
const CREDENTIALS_SERVICE = 'Claude Code-credentials';
const DEFAULT_ACCOUNT = 'claude-code-user';
const PLAIN_ACCOUNT_NAME = /^[a-zA-Z0-9._-]+$/;
const MAX_CREDENTIAL_CHUNKS = 64;

/** Claude Code's config dir: CLAUDE_SECURESTORAGE_CONFIG_DIR when set (empty means the default), then CLAUDE_CONFIG_DIR, then ~/.claude. */
function claudeConfigDir(homedir, env) {
    const defaultDir = path.join(homedir, '.claude');
    const secureDir = env[SECURE_STORAGE_DIR_ENV_VAR];
    if (secureDir !== undefined) return (secureDir || defaultDir).normalize('NFC');
    return (env[CONFIG_DIR_ENV_VAR] || defaultDir).normalize('NFC');
}

/** The credentials service name; a non-default config dir appends `-` and the first 8 hex chars of the dir's SHA-256. */
function claudeCredentialsService(homedir, env) {
    const secureDir = env[SECURE_STORAGE_DIR_ENV_VAR];
    const isDefaultDir = secureDir !== undefined ? secureDir === '' : !env[CONFIG_DIR_ENV_VAR];
    if (isDefaultDir) return CREDENTIALS_SERVICE;
    const hashedDir = secureDir !== undefined ? secureDir.normalize('NFC') : claudeConfigDir(homedir, env);
    return `${CREDENTIALS_SERVICE}-${createHash('sha256').update(hashedDir).digest('hex').slice(0, 8)}`;
}

/**
 * The macOS keychain account: $USER, else the OS user name, when it is a plain name; otherwise `claude-code-user`.
 * @param {() => string | undefined} readOsUserName  called only when $USER is unset
 */
function claudeKeychainAccount(env, readOsUserName) {
    const name = env.USER || readOsUserName();
    return typeof name === 'string' && PLAIN_ACCOUNT_NAME.test(name) ? name : DEFAULT_ACCOUNT;
}

/** The Windows Credential Manager target: `<service>/claude-code-user`. */
function claudeCredentialManagerTarget(homedir, env) {
    return `${claudeCredentialsService(homedir, env)}/${DEFAULT_ACCOUNT}`;
}

function claudeCredentialsFilePath(homedir, env) {
    return path.join(claudeConfigDir(homedir, env), '.credentials.json');
}

/** Where Claude Code caches its feature flags: `<config dir>/.config.json` when it exists, else `.claude.json`. */
function claudeSettingsFilePaths(homedir, env) {
    return {
        legacyPath: path.join(claudeConfigDir(homedir, env), '.config.json'),
        configPath: path.join(env[CONFIG_DIR_ENV_VAR] || homedir, '.claude.json'),
    };
}

/** Claude Code's Credential Manager rollout check. */
function isCredentialManagerEnabled(env, settingsJson) {
    if (env[FORCE_CREDENTIAL_MANAGER_ENV_VAR] === '1') return true;
    return settingsJson?.cachedGrowthBookFeatures?.tengu_windows_credman === true;
}

function claudeEnvironmentToken(env) {
    const token = env[TOKEN_ENV_VAR]?.trim();
    return token ? token : undefined;
}

/** The access token and plan from a credentials blob; `accessToken` is undefined when the blob holds none. */
function parseClaudeCredentials(json) {
    const oauth = json?.claudeAiOauth;
    const plan = [oauth?.subscriptionType, oauth?.rateLimitTier]
        .filter((value) => typeof value === 'string' && value.length > 0)
        .join(' · ');
    return {
        accessToken: typeof oauth?.accessToken === 'string' && oauth.accessToken.length > 0 ? oauth.accessToken : undefined,
        plan: plan || undefined,
    };
}

/**
 * Credential Manager splits a large blob: `<target>#m` holds `{ "n": <chunk count>, "l": <length> }`, and
 * `<target>#0`…`#<n-1>` hold the base64 of the UTF-8 JSON.
 * @returns {{ count: number, length?: number } | { problem: string }}
 */
function parseChunkIndex(indexText) {
    let index;
    try {
        index = JSON.parse(indexText);
    } catch (error) {
        return { problem: `the chunk index is not JSON (${error.name})` };
    }
    const count = index?.n;
    if (!Number.isInteger(count) || count < 1 || count > MAX_CREDENTIAL_CHUNKS) {
        return { problem: `the chunk index gives ${String(count)} chunks` };
    }
    return typeof index.l === 'number' ? { count, length: index.l } : { count };
}

function chunkTargetNames(target, count) {
    return Array.from({ length: count }, (_, position) => `${target}#${position}`);
}

/**
 * @param {{ count: number, length?: number }} chunkIndex
 * @param {(string | null)[]} chunkTexts  in order; null where a chunk is missing
 * @returns {{ text: string, isLengthMatching: boolean } | { problem: string }}
 */
function joinCredentialChunks(chunkIndex, chunkTexts) {
    const presentCount = chunkTexts.filter((chunk) => typeof chunk === 'string').length;
    if (chunkTexts.length !== chunkIndex.count || presentCount !== chunkIndex.count) {
        return { problem: `${presentCount} of ${chunkIndex.count} chunks present` };
    }
    const base64 = chunkTexts.join('');
    const text = Buffer.from(base64, 'base64').toString('utf8');
    const isLengthMatching =
        chunkIndex.length === undefined || chunkIndex.length === base64.length || chunkIndex.length === Buffer.byteLength(text);
    return { text, isLengthMatching };
}

function claudeWindow(id, label, percent, resetsAtValue) {
    const usedPercent = toUsedPercent(percent);
    const reset = parseIsoResetTime(resetsAtValue);
    if (usedPercent === undefined || !reset.isValid) return undefined;
    return reset.resetsAt ? { id, label, usedPercent, resetsAt: reset.resetsAt } : { id, label, usedPercent };
}

/** Per-model weekly windows: `limits[]` items of kind `weekly_scoped`, labelled with the model's display name. */
function modelWeeklyWindows(limits) {
    if (!Array.isArray(limits)) return [];
    const windows = [];
    for (const item of limits) {
        if (item?.kind !== 'weekly_scoped') continue;
        const model = item.scope?.model?.display_name;
        if (typeof model !== 'string' || model.length === 0) continue;
        const window = claudeWindow(`weekly:${model}`, model, item.percent, item.resets_at);
        if (window) windows.push(window);
    }
    return windows;
}

/**
 * The usage answer as a snapshot: `session` (5h) from `five_hour`, `weekly` from `seven_day`, and one
 * `weekly:<model>` per model window. A window whose percentage or reset time cannot be read is left out.
 */
function parseClaudeUsage(json, plan, fetchedAt) {
    const answer = json && typeof json === 'object' ? json : {};
    const windows = [
        claudeWindow('session', '5h', answer.five_hour?.utilization, answer.five_hour?.resets_at),
        claudeWindow('weekly', 'Weekly', answer.seven_day?.utilization, answer.seven_day?.resets_at),
        ...modelWeeklyWindows(answer.limits),
    ].filter(Boolean);
    const snapshot = { agentId: 'claude', windows, fetchedAt };
    if (plan) snapshot.plan = plan;
    return snapshot;
}

module.exports = {
    claudeConfigDir,
    claudeCredentialsService,
    claudeKeychainAccount,
    claudeCredentialManagerTarget,
    claudeCredentialsFilePath,
    claudeSettingsFilePaths,
    isCredentialManagerEnabled,
    claudeEnvironmentToken,
    parseClaudeCredentials,
    parseChunkIndex,
    chunkTargetNames,
    joinCredentialChunks,
    parseClaudeUsage,
};
