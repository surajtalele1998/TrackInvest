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
        crypto: globalThis.crypto,
        TextEncoder,
        TextDecoder,
        atob,
        btoa,
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
assert.strictEqual(typeof app.escapeHtml, 'function');
assert.strictEqual(typeof app.encryptData, 'function');
assert.strictEqual(typeof app.decryptData, 'function');
assert.strictEqual(typeof app.calculateMonthlySIPValue, 'function');
assert.strictEqual(typeof app.calculateEMIValue, 'function');
assert.strictEqual(typeof app.calculateInflationValue, 'function');

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

assert.strictEqual(
    app.escapeHtml('<img src=x onerror=alert(1)> " & \''),
    '&lt;img src=x onerror=alert(1)&gt; &quot; &amp; &#39;'
);

const formatted = app.formatAIResponse('<img src=x onerror=alert(1)> **Safe** [bad](javascript:alert(1))');
assert(!formatted.includes('<img'), 'AI markdown output must not render raw HTML tags');
assert(!formatted.includes('onerror='), 'AI markdown output must not keep event handlers');
assert(!formatted.includes('javascript:'), 'AI markdown output must not keep unsafe links');
assert(formatted.includes('&lt;img'), 'AI markdown output should escape raw HTML');
assert(formatted.includes('<strong>Safe</strong>'), 'safe markdown formatting should still render');

assert.strictEqual(app.calculateMonthlySIPValue(100000, 10, 12) > 0, true);
assert.strictEqual(app.calculateMonthlySIPValue(100000, 10, 0) > 0, true);
assert.strictEqual(app.calculateMonthlySIPValue(0, 10, 12), null);
assert.strictEqual(app.calculateEMIValue(100000, 5, 0), 100000 / 60);
assert.strictEqual(app.calculateEMIValue(100000, 0, 8), null);
assert.strictEqual(app.calculateInflationValue(100000, 10, 6) > 100000, true);
assert.strictEqual(app.calculateInflationValue(100000, -1, 6), null);

(async () => {
    const secret = JSON.stringify({ investments: [{ note: '<secret>' }], geminiKey: 'AIza-secret' });
    const encrypted = await app.encryptData(secret, '1234');
    assert(encrypted.startsWith('ENC2:'), 'encrypted backups should use the versioned ENC2 format');
    assert(!encrypted.includes('AIza-secret'), 'encrypted backup must not contain plaintext API keys');
    assert.strictEqual(await app.decryptData(encrypted, '1234'), secret);
})().catch(err => {
    console.error(err);
    process.exit(1);
});
