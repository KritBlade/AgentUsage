'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const core = require('../src/features/claude-usage/claude-usage-core.js');

/** The usage endpoint's answer on 2026-11-17 at 20:29 UTC, trimmed to the fields read. */
const LIVE_ANSWER = {
    five_hour: { utilization: 4.0, resets_at: '2026-11-18T00:29:59.591449+00:00' },
    seven_day: { utilization: 75.0, resets_at: '2026-11-18T08:59:59.591469+00:00' },
    seven_day_opus: null,
    seven_day_sonnet: null,
    limits: [
        { kind: 'session', group: 'session', percent: 4, severity: 'normal', resets_at: '2026-11-18T00:29:59.591449+00:00', scope: null },
        { kind: 'weekly_all', group: 'weekly', percent: 75, severity: 'warning', resets_at: '2026-11-18T08:59:59.591469+00:00', scope: null },
        {
            kind: 'weekly_scoped',
            group: 'weekly',
            percent: 2,
            severity: 'normal',
            resets_at: '2026-11-18T08:59:59.591618+00:00',
            scope: { model: { id: null, display_name: 'Fable' }, surface: null },
        },
    ],
};

test('the 2026-11-17 answer gives 5h, Weekly and Fable', () => {
    const snapshot = core.parseClaudeUsage(LIVE_ANSWER, 'max · default_claude_max_5x', new Date('2026-11-17T20:29:00Z'));
    assert.deepEqual(
        snapshot.windows.map((window) => [window.id, window.label, window.usedPercent]),
        [
            ['session', '5h', 4],
            ['weekly', 'Weekly', 75],
            ['weekly:Fable', 'Fable', 2],
        ],
    );
    assert.equal(snapshot.windows[0].resetsAt.toISOString(), '2026-11-18T00:29:59.591Z');
    assert.equal(snapshot.plan, 'max · default_claude_max_5x');
    assert.equal(snapshot.agentId, 'claude');
});

test('a window with a null reset time stays, with no reset time', () => {
    const snapshot = core.parseClaudeUsage({ five_hour: { utilization: 0, resets_at: null } }, undefined, new Date());
    assert.deepEqual(snapshot.windows, [{ id: 'session', label: '5h', usedPercent: 0 }]);
    assert.equal('plan' in snapshot, false);
});

test('a window with a wrong-typed or unparseable reset time is left out', () => {
    const snapshot = core.parseClaudeUsage(
        { five_hour: { utilization: 3, resets_at: 1234 }, seven_day: { utilization: 5, resets_at: 'not a date' } },
        undefined,
        new Date(),
    );
    assert.deepEqual(snapshot.windows, []);
});

test('the old per-model fields are not read (D4)', () => {
    const snapshot = core.parseClaudeUsage(
        { seven_day_opus: { utilization: 50, resets_at: '2026-11-18T08:59:59Z' } },
        undefined,
        new Date(),
    );
    assert.deepEqual(snapshot.windows, []);
});

test('the credentials service name follows the config dir', () => {
    assert.equal(core.claudeCredentialsService('/home/me', {}), 'Claude Code-credentials');
    assert.equal(core.claudeCredentialsService('/home/me', { CLAUDE_SECURESTORAGE_CONFIG_DIR: '' }), 'Claude Code-credentials');
    const suffix = createHash('sha256').update('/work/claude').digest('hex').slice(0, 8);
    assert.equal(core.claudeCredentialsService('/home/me', { CLAUDE_CONFIG_DIR: '/work/claude' }), `Claude Code-credentials-${suffix}`);
    assert.equal(
        core.claudeCredentialsService('/home/me', { CLAUDE_SECURESTORAGE_CONFIG_DIR: '/work/claude', CLAUDE_CONFIG_DIR: '/other' }),
        `Claude Code-credentials-${suffix}`,
    );
});

test('the config dir and credentials file follow the environment', () => {
    assert.equal(core.claudeConfigDir('/home/me', {}), '/home/me/.claude');
    assert.equal(core.claudeConfigDir('/home/me', { CLAUDE_CONFIG_DIR: '/work/claude' }), '/work/claude');
    assert.equal(core.claudeCredentialsFilePath('/home/me', {}), '/home/me/.claude/.credentials.json');
});

test('the keychain account is $USER or the OS user when plain, else claude-code-user', () => {
    let calls = 0;
    const osUser = (name) => () => {
        calls += 1;
        return name;
    };
    assert.equal(core.claudeKeychainAccount({ USER: 'goten' }, osUser('ignored')), 'goten');
    assert.equal(calls, 0, 'the OS user name is read only when $USER is unset');
    assert.equal(core.claudeKeychainAccount({}, osUser('alice')), 'alice');
    assert.equal(core.claudeKeychainAccount({ USER: 'has space' }, osUser('alice')), 'claude-code-user');
    assert.equal(core.claudeKeychainAccount({}, osUser(undefined)), 'claude-code-user');
});

test('the Credential Manager target and rollout check', () => {
    assert.equal(core.claudeCredentialManagerTarget('C:\\Users\\me', {}), 'Claude Code-credentials/claude-code-user');
    assert.equal(core.isCredentialManagerEnabled({ CLAUDE_CODE_FORCE_WINDOWS_CREDMAN: '1' }, undefined), true);
    assert.equal(core.isCredentialManagerEnabled({}, { cachedGrowthBookFeatures: { tengu_windows_credman: true } }), true);
    assert.equal(core.isCredentialManagerEnabled({}, { cachedGrowthBookFeatures: { tengu_windows_credman: 'true' } }), false);
    assert.equal(core.isCredentialManagerEnabled({}, undefined), false);
});

test('the environment token wins when set', () => {
    assert.equal(core.claudeEnvironmentToken({ CLAUDE_CODE_OAUTH_TOKEN: '  abc  ' }), 'abc');
    assert.equal(core.claudeEnvironmentToken({ CLAUDE_CODE_OAUTH_TOKEN: '   ' }), undefined);
    assert.equal(core.claudeEnvironmentToken({}), undefined);
});

test('a credentials blob gives the token and plan', () => {
    const blob = { claudeAiOauth: { accessToken: 'token-value', subscriptionType: 'max', rateLimitTier: 'default_claude_max_5x' } };
    assert.deepEqual(core.parseClaudeCredentials(blob), { accessToken: 'token-value', plan: 'max · default_claude_max_5x' });
    assert.deepEqual(core.parseClaudeCredentials({ claudeAiOauth: { accessToken: '' } }), { accessToken: undefined, plan: undefined });
    assert.deepEqual(core.parseClaudeCredentials(null), { accessToken: undefined, plan: undefined });
});

test('Credential Manager chunks join into the stored blob', () => {
    const text = JSON.stringify({ claudeAiOauth: { accessToken: 'x'.repeat(3000) } });
    const base64 = Buffer.from(text, 'utf8').toString('base64');
    const pieces = [base64.slice(0, 1500), base64.slice(1500, 3000), base64.slice(3000)];
    const chunkIndex = core.parseChunkIndex(JSON.stringify({ n: 3, l: base64.length }));
    assert.deepEqual(chunkIndex, { count: 3, length: base64.length });
    assert.deepEqual(core.chunkTargetNames('T', 3), ['T#0', 'T#1', 'T#2']);
    assert.deepEqual(core.joinCredentialChunks(chunkIndex, pieces), { text, isLengthMatching: true });
    assert.deepEqual(core.joinCredentialChunks(chunkIndex, [pieces[0], null, pieces[2]]), { problem: '2 of 3 chunks present' });
    assert.equal(core.joinCredentialChunks({ count: 3, length: 7 }, pieces).isLengthMatching, false);
    assert.ok(core.parseChunkIndex('{"n":0}').problem);
    assert.ok(core.parseChunkIndex('not json').problem);
});
