'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createModuleLog, setLogSink, setLogVerbosity } = require('../src/shared/log.js');

function captureSink() {
    const lines = [];
    return { lines, sink: { error: (line) => lines.push(['error', line]), warn: (line) => lines.push(['warn', line]), info: (line) => lines.push(['info', line]) } };
}

test('errors and warnings always log; lifecycle, verbose and trace follow the verbosity', (t) => {
    const { lines, sink } = captureSink();
    setLogSink(sink);
    t.after(() => {
        setLogSink(undefined);
        setLogVerbosity('off');
    });
    const log = createModuleLog('grok-usage');
    setLogVerbosity('off');
    log.error('e');
    log.warn('w');
    log.lifecycle('l');
    log.verbose('v');
    log.trace('t');
    assert.deepEqual(lines, [
        ['error', '[grok-usage] e'],
        ['warn', '[grok-usage] w'],
    ]);
    lines.length = 0;
    setLogVerbosity('verbose');
    log.lifecycle('l');
    log.verbose('v');
    log.trace('t');
    assert.deepEqual(lines, [
        ['info', '[grok-usage] l'],
        ['info', '[grok-usage] v'],
    ]);
    assert.equal(log.isEnabled('trace'), false);
    setLogVerbosity('not a level');
    assert.equal(log.isEnabled('lifecycle'), false);
});

test('each line names its source and sub-tags; errors and objects are formatted', (t) => {
    const { lines, sink } = captureSink();
    setLogSink(sink);
    t.after(() => setLogSink(undefined));
    const log = createModuleLog('codex-usage').child('rpc');
    log.warn('failed:', new TypeError('boom'), { code: 7 });
    const [[level, line]] = lines;
    assert.equal(level, 'warn');
    assert.match(line, /^\[codex-usage\] \[rpc\] failed: TypeError: boom\n/);
    assert.match(line, /\{ code: 7 \}$/);
});
