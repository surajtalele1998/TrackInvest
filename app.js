/**
 * app.js - Main Application Entry Point
 * Orchestrates modules and initializes the Next-Gen experience.
 */

import { db, migrateLegacyData, loadSettings, getSetting, setSetting } from './js/db.js';
import * as utils from './js/utils.js';
import * as engine from './js/engine.js';
import * as ui from './js/ui.js';
import * as ai from './js/ai.js';
import * as sync from './js/sync.js';
import * as charts from './js/charts.js';
import * as market from './js/market.js';

// Global Exposure for Legacy HTML Handlers (Zero-Loss Migration)
window.db = db;
window.utils = utils;
window.ui = ui;
window.ai = ai;
window.sync = sync;
window.engine = engine;
window.charts = charts;
window.market = market;

// Compatibility aliases for HTML onclicks
window.openSheet = ui.openSheet;
window.closeOverlays = utils.closeOverlays;
window.haptic = utils.haptic;
window.askTrackInvestAI = ai.askTrackInvestAI;
window.saveInvestment = ui.saveInvestment;
window.deleteInvestment = ui.deleteInvestment;
window.togglePrivacy = ui.togglePrivacy;
window.copyNetWorth = utils.copyNetWorth;
window.exportToCSV = utils.exportToCSV;
window.openInvestSheet = ui.openInvestSheet;
window.setInvestType = ui.setInvestType;
window.searchMFForLog = ui.searchMFForLog;
window.handleMFSelectForLog = ui.handleMFSelectForLog;
window.closeSubSheet = ui.closeSubSheet;
window.executeQuickLog = ui.executeQuickLog;
window.deleteQuickLog = ui.deleteQuickLog;
window.nearbyBroadcast = sync.nearbyBroadcast;
window.nearbyTuneIn = sync.nearbyTuneIn;
window.closeNearbySync = sync.closeNearbySync;
window.renderAll = ui.renderAll;
window.switchTab = ui.switchTab;
window.saveGoal = ui.saveGoal;
window.openGoalSheet = ui.openGoalSheet;
window.openCategoryDetails = ui.openCategoryDetails;
window.openMonthlyTargetSheet = ui.openMonthlyTargetSheet;
window.openMonthDetails = ui.openMonthDetails;
window.openProjectionSheet = ui.openProjectionSheet;
window.openAIPredictSheet = ui.openAIPredictSheet;
window.openWealthBlueprint = ui.openWealthBlueprint;
window.openRebalanceSheet = ui.openRebalanceSheet;
window.copyBlueprint = ui.copyBlueprint;
window.updateProjectionSlider = ui.updateProjectionSlider;
window.unlockApp = ui.unlockApp;
window.openAIChat = ui.openAIChat;
window.openDividendSheet = ui.openDividendSheet;
window.openFIRESheet = ui.openFIRESheet;
window.openNearbySync = ui.openNearbySync;
window.toggleSyncFields = ui.toggleSyncFields;
window.openSettings = ui.openSettings;
window.openSubSheet = ui.openSubSheet;
window.sendAIChat = ui.sendAIChat;
window.askAIEngine = ui.askAIEngine;
window.calculateInflation = ui.calculateInflation;
window.viewChatHistory = ui.viewChatHistory;
window.saveChatSession = ui.saveChatSession;
window.exportData = () => utils.exportData(db, getSetting);
window.restoreData = (e) => utils.restoreData(e, db);
window.importCSV = (e) => utils.importCSV(e, db);
window.dataCleanup = () => utils.dataCleanup(db);
window.exportTaxPDF = () => utils.exportTaxPDF(db);

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'flex';
});

window.triggerPWAInstall = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('pwa-install-btn').style.display = 'none';
        }
        deferredPrompt = null;
    }
};

/**
 * Main Initialization Sequence
 */
async function initApp() {
    console.log("🚀 Initializing TrackInvest Next-Gen...");
    
    await migrateLegacyData();
    await loadSettings();
    
    // Check for App Lock
    await ui.checkAppLock();
    
    // Auto-sync NAVs in background
    market.syncPortfolioNAVs();
    
    // 2. UI Localization & Initial State
    const theme = await getSetting('theme', 'indigo');
    document.documentElement.setAttribute('data-theme', theme);
    
    // 3. Initial Dashboard Render
    await ui.renderAll();
    
    // 4. Register Event Handlers
    registerEvents();

    // 5. Handle Signaling Links (Handshake)
    if (window.location.hash.includes('sync=')) {
        await sync.handleSyncHash(window.location.hash);
        // Clear hash after processing
        history.replaceState(null, null, ' ');
    }
}

function registerEvents() {
    // Listen for data changes to refresh UI
    window.addEventListener('data-synced', () => {
        ui.renderAll();
        utils.showSnackbar("Portfolio Synchronized", "sync");
    });

    // Handle back button for sheets
    window.addEventListener('popstate', () => {
        utils.closeOverlays();
    });
}

// Start the app
initApp().catch(err => {
    console.error("Critical Init Failure:", err);
});
