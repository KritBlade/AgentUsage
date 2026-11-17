'use strict';
/**
 * Holds src/ to the Dev layout rules: only src/vscode/ requires the editor; a feature reaches another feature only
 * through its index.js; shared/ and the host folders never import a feature; every relative require names an
 * existing .js file; console is used only by the logger.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOT = path.join(__dirname, '..', 'src');
const HOST_FOLDERS = ['vscode', 'macos', 'windows'];

function listSourceFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listSourceFiles(fullPath);
        return entry.name.endsWith('.js') ? [fullPath] : [];
    });
}

const FILES = listSourceFiles(SOURCE_ROOT).map((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const requires = [...text.matchAll(/require\(\s*'([^']+)'\s*\)/g)].map((match) => match[1]);
    return { filePath, relativePath: path.relative(SOURCE_ROOT, filePath).split(path.sep).join('/'), text, requires };
});

function topFolder(relativePath) {
    return relativePath.includes('/') ? relativePath.split('/')[0] : '';
}

function featureOf(relativePath) {
    const parts = relativePath.split('/');
    return parts[0] === 'features' ? parts[1] : undefined;
}

test('src holds files to check', () => {
    assert.ok(FILES.length > 20);
});

test('only src/vscode/ requires vscode', () => {
    const offenders = FILES.filter((file) => file.requires.includes('vscode') && topFolder(file.relativePath) !== 'vscode');
    assert.deepEqual(offenders.map((file) => file.relativePath), []);
});

test('every relative require names an existing .js file', () => {
    const broken = [];
    for (const file of FILES) {
        for (const specifier of file.requires.filter((spec) => spec.startsWith('.'))) {
            const target = path.resolve(path.dirname(file.filePath), specifier);
            if (!specifier.endsWith('.js') || !fs.existsSync(target)) broken.push(`${file.relativePath} → ${specifier}`);
        }
    }
    assert.deepEqual(broken, []);
});

test('a feature reaches another feature only through its index.js', () => {
    const deepImports = [];
    for (const file of FILES) {
        const ownFeature = featureOf(file.relativePath);
        for (const specifier of file.requires.filter((spec) => spec.startsWith('.'))) {
            const target = path.relative(SOURCE_ROOT, path.resolve(path.dirname(file.filePath), specifier)).split(path.sep).join('/');
            const targetFeature = featureOf(target);
            if (targetFeature && targetFeature !== ownFeature && !target.endsWith(`features/${targetFeature}/index.js`)) {
                deepImports.push(`${file.relativePath} → ${target}`);
            }
        }
    }
    assert.deepEqual(deepImports, []);
});

test('shared/ and the host folders never import a feature', () => {
    const upward = [];
    for (const file of FILES) {
        if (![...HOST_FOLDERS, 'shared'].includes(topFolder(file.relativePath))) continue;
        for (const specifier of file.requires.filter((spec) => spec.startsWith('.'))) {
            const target = path.relative(SOURCE_ROOT, path.resolve(path.dirname(file.filePath), specifier)).split(path.sep).join('/');
            if (target.startsWith('features/')) upward.push(`${file.relativePath} → ${target}`);
        }
    }
    assert.deepEqual(upward, []);
});

test('console is used only by the logger', () => {
    const users = FILES.filter((file) => /\bconsole\./.test(file.text) && file.relativePath !== 'shared/log.js');
    assert.deepEqual(users.map((file) => file.relativePath), []);
});

test('every catch logs, rethrows, answers a failure, or is marked EXPECTED', () => {
    const silent = [];
    for (const file of FILES) {
        for (const match of file.text.matchAll(/catch\s*(\(\s*\w+\s*\))?\s*\{([\s\S]{0,400}?)\n\s*\}/g)) {
            const body = match[2];
            if (!/log\.(warn|error)|EXPECTED:|return \{ (problem|state)|throw /.test(body)) silent.push(`${file.relativePath}: ${body.trim().slice(0, 60)}`);
        }
    }
    assert.deepEqual(silent, []);
});
