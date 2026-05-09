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

/**
 * Main Initialization Sequence
 */
async function initApp() {
    console.log("🚀 Initializing TrackInvest Next-Gen...");
    
    // 1. Database Migration & Setup
    await migrateLegacyData();
    await loadSettings();
    
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
