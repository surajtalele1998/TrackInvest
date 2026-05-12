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
        insertBefore() {},
        removeChild() {},
        addEventListener() {},
        removeEventListener() {},
        querySelectorAll() { return []; },
        querySelector() { return null; },
        getContext() { return {}; },
        setAttribute() {},
        removeAttribute() {},
        focus() {}
    };
}

function loadApp() {
    const elements = new Map();
    const document = {
        body: makeElement(),
        head: makeElement(),
        documentElement: makeElement(),
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
        localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        crypto: globalThis.crypto,
        TextEncoder,
        TextDecoder,
        atob,
        btoa,
        navigator: { userAgent: '', clipboard: { writeText() { return Promise.resolve(); } } },
        location: { reload() {}, origin: 'https://example.com', href: 'https://example.com' },
        history: { state: null, replaceState() {}, pushState() {}, back() {} },
        addEventListener() {},
        removeEventListener() {},
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL: { createObjectURL() { return ''; } },
        Blob: function Blob() {},
        FileReader: function FileReader() {},
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
        RTCPeerConnection: function RTCPeerConnection() {},
        confetti: function confetti() {},
        alert() {},
        confirm() { return false; },
        prompt() { return null; }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    const parts = ['app_part1.js', 'app_part2.js', 'app_part3.js'];
    for (const part of parts) {
        const source = fs.readFileSync(path.join(__dirname, '..', part), 'utf8');
        vm.runInContext(source, sandbox, { filename: part });
    }
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
assert(
    /<strong[^>]*>Safe<\/strong>/.test(formatted),
    'safe markdown formatting should still render'
);

assert.strictEqual(app.calculateMonthlySIPValue(100000, 10, 12) > 0, true);
assert.strictEqual(app.calculateMonthlySIPValue(100000, 10, 0) > 0, true);
assert.strictEqual(app.calculateMonthlySIPValue(0, 10, 12), null);
assert.strictEqual(app.calculateEMIValue(100000, 5, 0), 100000 / 60);
assert.strictEqual(app.calculateEMIValue(100000, 0, 8), null);
assert.strictEqual(app.calculateInflationValue(100000, 10, 6) > 100000, true);
assert.strictEqual(app.calculateInflationValue(100000, -1, 6), null);

// Recurring-SIP date helpers must clamp the requested day to each month's last
// day so that 31-day cadence never silently skips February or April.
{
    const advance = app.advanceMonth;
    assert(typeof advance === 'function', 'advanceMonth must be exported');
    const jan31 = new Date(2024, 0, 31);
    const feb = advance(jan31, 31);
    assert.strictEqual(feb.getFullYear(), 2024);
    assert.strictEqual(feb.getMonth(), 1, 'advancing Jan 31 by one month must land in February, not March');
    assert.strictEqual(feb.getDate(), 29, 'Feb 2024 (leap) clamps day 31 to 29');
    const mar = advance(feb, 31);
    assert.strictEqual(mar.getMonth(), 2, 'advancing Feb clamp-29 by one month must land in March');
    assert.strictEqual(mar.getDate(), 31, 'March can hold day 31');
    const apr = advance(mar, 31);
    assert.strictEqual(apr.getMonth(), 3, 'advancing March 31 by one month must land in April, not May');
    assert.strictEqual(apr.getDate(), 30, 'April clamps day 31 to 30');
}

// nextMonthlyRun is what saveInvestment uses to seed a recurring SIP's first
// nextRun. The pre-fix code did `new Date(date); nextDate.setMonth(+1)`, which
// silently overflowed Jan 31 → Mar 2, leaving processRecurring with the wrong
// intendedDay. Lock in the clamp behavior end-to-end.
{
    const fn = app.nextMonthlyRun;
    assert(typeof fn === 'function', 'nextMonthlyRun must be exported');
    const feb = fn(new Date(2024, 0, 31));
    assert.strictEqual(feb.getMonth(), 1, 'Jan 31 seed must produce a Feb nextRun, not March');
    assert.strictEqual(feb.getDate(), 29, 'Feb 2024 (leap) clamps to 29');
    const aprFromMar31 = fn(new Date(2024, 2, 31));
    assert.strictEqual(aprFromMar31.getMonth(), 3, 'Mar 31 seed must produce an Apr nextRun, not May');
    assert.strictEqual(aprFromMar31.getDate(), 30, 'April clamps to 30');
}

// Large payloads must round-trip through encrypt/decrypt without exhausting
// the JS engine's argument-spread limit on big Uint8Arrays.
(async () => {
    const secret = JSON.stringify({ investments: [{ note: '<secret>' }], geminiKey: 'AIza-secret' });
    const encrypted = await app.encryptData(secret, '1234');
    assert(encrypted.startsWith('ENC2:'), 'encrypted backups should use the versioned ENC2 format');
    assert(!encrypted.includes('AIza-secret'), 'encrypted backup must not contain plaintext API keys');
    assert.strictEqual(await app.decryptData(encrypted, '1234'), secret);

    // ~250 KB payload exercises the chunked base64 path
    const big = JSON.stringify({ blob: 'x'.repeat(250_000) });
    const bigEnc = await app.encryptData(big, 'pin');
    assert(bigEnc.startsWith('ENC2:'), 'large payloads still use ENC2');
    assert.strictEqual(await app.decryptData(bigEnc, 'pin'), big, 'large payload survives round-trip');
})().catch(err => {
    console.error(err);
    process.exit(1);
});
