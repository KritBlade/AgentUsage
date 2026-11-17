'use strict';
/**
 * Central logger: one verbosity setting, one source tag per line.
 *
 * Levels follow call frequency:
 *   error / warn  — always on
 *   lifecycle     — once-per-run state changes   (verbosity >= lifecycle)
 *   verbose       — one line per agent read      (verbosity >= verbose)
 *   trace         — raw provider answers         (verbosity >= trace)
 *
 * Every line names its source: `[<source>] [<sub-tag>]… message`.
 *   const log = createModuleLog('grok-usage');
 *   log.warn('billing request failed:', error);
 *
 * Lines go to the sink set with setLogSink(); activation installs the output channel. Until then the console sink
 * holds, so nothing logged earlier is lost.
 */
const { inspect } = require('node:util');

const VERBOSITY_LEVELS = Object.freeze({ off: 0, lifecycle: 1, verbose: 2, trace: 3 });

const consoleSink = Object.freeze({
    error: (line) => console.error(line),
    warn: (line) => console.warn(line),
    info: (line) => console.log(line),
});

let activeSink = consoleSink;
let verbosity = VERBOSITY_LEVELS.off;

/** @param {{ error(line: string): void, warn(line: string): void, info(line: string): void } | undefined} sink */
function setLogSink(sink) {
    activeSink = sink ?? consoleSink;
}

/** @param {string} level one of LOG_VERBOSITY_NAMES; any other value means off */
function setLogVerbosity(level) {
    verbosity = VERBOSITY_LEVELS[level] ?? VERBOSITY_LEVELS.off;
}

function formatArgument(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
    return inspect(value, { depth: 6, breakLength: Infinity });
}

function formatLine(prefix, args) {
    return [prefix, ...args.map(formatArgument)].join(' ');
}

function createTaggedLog(tags) {
    const prefix = tags.map((tag) => `[${tag}]`).join(' ');
    const isEnabled = (level) => verbosity >= (VERBOSITY_LEVELS[level] ?? Infinity);
    return Object.freeze({
        /** Guards expensive argument building; the level methods gate themselves. */
        isEnabled,
        error: (...args) => activeSink.error(formatLine(prefix, args)),
        warn: (...args) => activeSink.warn(formatLine(prefix, args)),
        lifecycle: (...args) => {
            if (isEnabled('lifecycle')) activeSink.info(formatLine(prefix, args));
        },
        verbose: (...args) => {
            if (isEnabled('verbose')) activeSink.info(formatLine(prefix, args));
        },
        trace: (...args) => {
            if (isEnabled('trace')) activeSink.info(formatLine(prefix, args));
        },
        /** The same logger with one more tag. */
        child: (subTag) => createTaggedLog([...tags, String(subTag)]),
    });
}

/** The logger for one source: its feature folder, or its host or shared file name without `-core`. */
function createModuleLog(source) {
    return createTaggedLog([String(source)]);
}

module.exports = {
    createModuleLog,
    setLogSink,
    setLogVerbosity,
    LOG_VERBOSITY_NAMES: Object.freeze(Object.keys(VERBOSITY_LEVELS)),
};
