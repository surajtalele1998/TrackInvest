const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement() {
    return {
        style: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        dataset: {},
        value: '',
        innerHTML: '',
        innerText: '',
        textContent: '',
        appendChild() {},
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll() { return []; },
        getContext() { return {}; }
    };
}

function loadApp() {
    const elements = new Map();
    const document = {
        body: makeElement(),
        createElement: makeElement,
        addEventListener() {},
        querySelectorAll() { return []; },
        querySelector() { return makeElement(); },
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, makeElement());
            return elements.get(id);
        }
    };

    const sandbox = {
        console,
        document,
        localStorage: { getItem() { return null; }, setItem() {} },
        navigator: {},
        location: { reload() {} },
        addEventListener() {},
        setTimeout,
        clearTimeout,
        URL: { createObjectURL() { return ''; } },
        Blob: function Blob() {},
        getComputedStyle() { return { getPropertyValue() { return ''; } }; },
        Chart: {
            defaults: {
                font: {},
                plugins: { tooltip: { titleFont: {}, callbacks: {} } }
            }
        },
        Swal: { fire() { return Promise.resolve({ isConfirmed: false }); } },
        QRCode: function QRCode() {},
        Html5Qrcode: function Html5Qrcode() {},
        RTCPeerConnection: function RTCPeerConnection() {}
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'),
        sandbox,
        { filename: 'app.js' }
    );
    return sandbox;
}

const app = loadApp();

assert.strictEqual(typeof app.createWebRTCQRFrames, 'function');
assert.strictEqual(typeof app.decodeWebRTCQRInput, 'function');

const longPayload = '{"type":"offer","sdp":"' + 'candidate:'.repeat(120) + '"}';
const frames = app.createWebRTCQRFrames(longPayload, 160);

assert(frames.length > 1, 'long WebRTC payloads should be split into several QR frames');
assert(frames.every(frame => frame.length <= 160), 'each QR frame should stay below the size limit');

const chunkStore = {};
const first = app.decodeWebRTCQRInput(frames[1], chunkStore);
assert.strictEqual(first.complete, false);
assert.strictEqual(first.received, 1);
assert.strictEqual(first.total, frames.length);

let decoded;
for (const frame of [frames[0], ...frames.slice(2)]) {
    decoded = app.decodeWebRTCQRInput(frame, chunkStore);
}

assert.strictEqual(decoded.complete, true);
assert.strictEqual(decoded.code, longPayload);

const single = app.decodeWebRTCQRInput('{"type":"answer","sdp":"short"}', {});
assert.strictEqual(single.complete, true);
assert.strictEqual(single.code, '{"type":"answer","sdp":"short"}');
assert.strictEqual(single.received, 1);
assert.strictEqual(single.total, 1);
