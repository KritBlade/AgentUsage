'use strict';
/** Loads the whole extension against an empty stand-in for the editor API: every module resolves and evaluates. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('src/index.js and every module it requires load', () => {
    const originalLoad = Module._load;
    Module._load = function loadWithEditorStandIn(request, ...rest) {
        if (request === 'vscode') return {};
        return originalLoad.call(this, request, ...rest);
    };
    try {
        const extension = require('../src/index.js');
        assert.equal(typeof extension.activate, 'function');
        assert.equal(typeof extension.deactivate, 'function');
    } finally {
        Module._load = originalLoad;
    }
});
