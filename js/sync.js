/**
 * sync.js - P2P Synchronization Engine
 * Handles WebRTC, Web Share API signaling, and data merging.
 */
import { db } from './db.js';
import { showSnackbar, haptic } from './utils.js';

let peerConnection = null;
let dataChannel = null;

/**
 * Initializes WebRTC connection
 */
export async function initWebRTC(isBroadcaster = false) {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(config);

    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log("[Sync] ICE State:", state);
        document.getElementById('sync-status-badge').innerText = state.toUpperCase();
    };

    if (isBroadcaster) {
        dataChannel = peerConnection.createDataChannel("syncData");
        setupDataChannel(dataChannel);
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        return offer;
    }

    peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };
}

function setupDataChannel(channel) {
    channel.onopen = () => {
        showSnackbar("Connected! Syncing...", "sync");
        syncData();
    };

    channel.onmessage = async (event) => {
        const remoteData = JSON.parse(event.data);
        await mergeData(remoteData);
        showSnackbar("Sync Complete", "done_all");
        haptic(50);
    };
}

async function syncData() {
    const investments = await db.investments.toArray();
    const settings = await db.settings.toArray();
    const data = { investments, settings, timestamp: Date.now() };
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(data));
    }
}

async function mergeData(remoteData) {
    console.log("[Sync] Merging remote data...");
    for (const inv of remoteData.investments) {
        const exists = await db.investments.where('date').equals(inv.date).and(i => i.amount === inv.amount).first();
        if (!exists) {
            delete inv.id; // Let Dexie generate a new one
            await db.investments.add(inv);
        }
    }
    // Refresh UI after merge
    window.dispatchEvent(new CustomEvent('data-synced'));
}

/**
 * Signaling via URL Hash
 */
export function generateSyncUrl(sdp, type = 'offer') {
    const data = btoa(JSON.stringify({ sdp, type }));
    return `${window.location.origin}${window.location.pathname}#sync=${data}`;
}

export async function handleSyncHash(hash) {
    const encoded = hash.split('sync=')[1];
    if (!encoded) return;
    
    const { sdp, type } = JSON.parse(atob(encoded));
    if (type === 'offer') {
        await initWebRTC(false);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Return answer URL or show it
        return generateSyncUrl(answer, 'answer');
    } else if (type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
}
