'use strict';
/**
 * Live check of the usage popup in an isolated VS Code: its own profile under `.vscode-test/`, this extension loaded
 * from source, real mouse events sent through the DevTools port. Measures the popup's opening on a click and on a
 * resting mouse, checks that a click elsewhere closes it, and that its Settings link closes it and opens AgentUsage's
 * settings page with the item still in its place.
 * Usage: node tools/popup-check.js   (VS Code from VSCODE_EXECUTABLE, else the first install path found)
 * A VS Code window opens for about half a minute; the profile folder is deleted at the end.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = require('../package.json');
const EXTENSION_ID = `${MANIFEST.publisher}.${MANIFEST.name}`;
const PROFILE = path.join(ROOT, '.vscode-test');
const PORT = 9333;
const CLICK_LIMIT_MS = 500;
const VSCODE_CANDIDATES = [
    '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
    path.join(process.env.LOCALAPPDATA ?? 'C:\\Users\\Default\\AppData\\Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    'C:\\Program Files\\Microsoft VS Code\\Code.exe',
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findVsCode() {
    const tried = process.env.VSCODE_EXECUTABLE ? [process.env.VSCODE_EXECUTABLE, ...VSCODE_CANDIDATES] : VSCODE_CANDIDATES;
    const found = tried.find((candidate) => fs.existsSync(candidate));
    if (!found) throw new Error(`VS Code not found; tried VSCODE_EXECUTABLE, then: ${tried.join(', ')}`);
    return found;
}

async function readJson(url) {
    return (await fetch(url)).json();
}

/** Opens the workbench page's DevTools connection; answers `send(method, params)` and `close()`. */
async function connect(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
    });
    let nextId = 1;
    const pending = new Map();
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
        }
    };
    return {
        send: (method, params = {}) =>
            new Promise((resolve) => {
                const id = nextId++;
                pending.set(id, resolve);
                socket.send(JSON.stringify({ id, method, params }));
            }),
        close: () => socket.close(),
    };
}

async function waitForWorkbench() {
    for (let attempt = 0; attempt < 60; attempt++) {
        await sleep(1000);
        try {
            const page = (await readJson(`http://127.0.0.1:${PORT}/json/list`)).find(
                (target) => target.type === 'page' && target.url.includes('workbench'),
            );
            if (page) return page;
        } catch (error) {
            // EXPECTED: the DevTools port opens only once the window has started.
            if (attempt === 59) throw error;
        }
    }
    throw new Error('the workbench page never appeared');
}

async function runChecks(devtools) {
    const evaluate = async (expression) => (await devtools.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
    const moveMouse = (x, y) => devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    const click = async (x, y) => {
        await moveMouse(x, y);
        await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    };
    const ITEM = `[...document.querySelectorAll('.statusbar-item')].find((element) => element.id === '${EXTENSION_ID}.agentUsage.status')`;
    const IS_POPUP_OPEN = `[...document.querySelectorAll('.workbench-hover, .monaco-hover')].some((element) => element.offsetParent !== null && element.innerText.includes('Refresh'))`;
    const waitForPopup = async (startMs, limitMs) => {
        while (Date.now() - startMs < limitMs) {
            if (await evaluate(IS_POPUP_OPEN)) return Date.now() - startMs;
            await sleep(20);
        }
        return undefined;
    };

    let itemText;
    for (let attempt = 0; attempt < 90 && !itemText?.includes('%'); attempt++) {
        itemText = await evaluate(`(${ITEM})?.innerText ?? null`);
        if (!itemText?.includes('%')) await sleep(1000);
    }
    if (!itemText?.includes('%')) throw new Error(`the AgentUsage item never showed a reading: ${JSON.stringify(itemText)}`);
    const item = await evaluate(`(() => { const r = (${ITEM}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    const away = { x: 700, y: 300 };
    const results = [];
    const record = (name, isPassing, detail) => results.push({ name, isPassing, detail });

    await moveMouse(away.x, away.y);
    await sleep(1000);
    let startMs = Date.now();
    await moveMouse(item.x, item.y);
    const restingMs = await waitForPopup(startMs, 4000);
    record('a resting mouse opens the popup', restingMs !== undefined, `${restingMs} ms`);
    await click(away.x, away.y);
    await sleep(1500);

    startMs = Date.now();
    await click(item.x, item.y);
    const clickMs = await waitForPopup(startMs, 4000);
    record('a click opens the popup at once', clickMs !== undefined && clickMs < CLICK_LIMIT_MS, `${clickMs} ms`);
    await click(away.x, away.y);
    await sleep(600);
    record('a click elsewhere closes it', !(await evaluate(IS_POPUP_OPEN)), '');

    const PLACE = `(() => { const element = ${ITEM}; const items = [...element.parentElement.children].filter((child) => child.classList.contains('statusbar-item')); const index = items.indexOf(element); return { left: items[index - 1]?.id ?? null, right: items[index + 1]?.id ?? null }; })()`;
    await click(item.x, item.y);
    await waitForPopup(Date.now(), 2000);
    const placeBefore = await evaluate(PLACE);
    const link = await evaluate(
        `(() => { const a = [...document.querySelectorAll('.workbench-hover a, .monaco-hover a')].find((e) => e.innerText.trim() === 'Settings'); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
    if (link) await click(link.x, link.y);
    await sleep(2500);
    record('its Settings link closes the popup', Boolean(link) && !(await evaluate(IS_POPUP_OPEN)), link ? '' : 'no Settings link');
    const placeAfter = await evaluate(PLACE);
    record(
        'the item keeps its place between the same neighbours after closing',
        placeAfter.left === placeBefore.left && placeAfter.right === placeBefore.right,
        `before ${JSON.stringify(placeBefore)}, after ${JSON.stringify(placeAfter)}`,
    );
    const search = await evaluate(`document.querySelector('.settings-editor .suggest-input-container .view-lines')?.innerText ?? null`);
    const checkboxCount = await evaluate(`document.querySelectorAll('.settings-editor .setting-list-object-input-key-checkbox').length`);
    record('its Settings link opens the filtered settings page', search === `@ext:${EXTENSION_ID}`, `search ${JSON.stringify(search)}`);
    record('the settings page shows the ten dot checkboxes', checkboxCount === 10, `${checkboxCount} checkboxes`);
    return results;
}

async function main() {
    const executable = findVsCode();
    fs.mkdirSync(path.join(PROFILE, 'workspace'), { recursive: true });
    const environment = Object.fromEntries(
        Object.entries(process.env).filter(([name]) => name !== 'ELECTRON_RUN_AS_NODE' && !name.startsWith('VSCODE_')),
    );
    const child = spawn(
        executable,
        [
            `--user-data-dir=${path.join(PROFILE, 'user-data')}`,
            `--extensions-dir=${path.join(PROFILE, 'extensions')}`,
            `--extensionDevelopmentPath=${ROOT}`,
            `--remote-debugging-port=${PORT}`,
            '--disable-workspace-trust',
            '--skip-release-notes',
            '--skip-welcome',
            '--new-window',
            path.join(PROFILE, 'workspace'),
        ],
        { stdio: 'ignore', env: environment },
    );
    const exited = new Promise((resolve) => child.once('exit', resolve));
    let devtools;
    try {
        devtools = await connect((await waitForWorkbench()).webSocketDebuggerUrl);
        const results = await runChecks(devtools);
        for (const { name, isPassing, detail } of results) {
            process.stdout.write(`${isPassing ? 'pass' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}\n`);
        }
        return results.every((result) => result.isPassing) ? 0 : 1;
    } finally {
        devtools?.close();
        try {
            const { webSocketDebuggerUrl } = await readJson(`http://127.0.0.1:${PORT}/json/version`);
            const browser = await connect(webSocketDebuggerUrl);
            await Promise.race([browser.send('Browser.close'), sleep(3000)]);
            browser.close();
        } catch (error) {
            process.stdout.write(`closing through DevTools failed (${error.message}); ending the process instead\n`);
            child.kill('SIGTERM');
        }
        await Promise.race([exited, sleep(10_000)]);
        fs.rmSync(PROFILE, { recursive: true, force: true });
    }
}

main().then(
    (exitCode) => {
        process.exitCode = exitCode;
    },
    (error) => {
        process.stderr.write(`popup-check failed: ${error.stack ?? error}\n`);
        process.exitCode = 1;
    },
);
