/**
 * db.js - Dexie.js Database Engine
 * Handles all IndexedDB operations with schema management and migrations.
 */

const db = new Dexie("TrackInvestDB");

// Define Schema
db.version(1).stores({
    investments: '++id, date, type, account, *tags',
    goals: '++id, title, target',
    recurring: '++id, type, amount',
    milestones: '++id, val',
    wealthLogs: '++id, date', // For historical net worth tracking
    chatHistory: '++id, timestamp',
    chatSessions: '++id, startTime',
    settings: 'id, value' // Key-value store for app settings like geminiKey, theme, etc.
});

/**
 * Migrates data from legacy localStorage to Dexie.
 * Ensures zero data loss during the upgrade.
 */
async function migrateLegacyData() {
    const legacyData = JSON.parse(localStorage.getItem('appHubInvestDb'));
    if (!legacyData) return;

    console.log("[DB] Starting migration from LocalStorage...");

    // Check if migration already done
    const migrationDone = await db.settings.get('migration_v1_complete');
    if (migrationDone) return;

    try {
        // 1. Migrate Investments
        if (legacyData.investments && legacyData.investments.length > 0) {
            await db.investments.bulkAdd(legacyData.investments);
        }

        // 2. Migrate Goals
        if (legacyData.goals) await db.goals.bulkAdd(legacyData.goals);
        if (legacyData.recurring) await db.recurring.bulkAdd(legacyData.recurring);
        if (legacyData.milestones) await db.milestones.bulkAdd(legacyData.milestones);
        if (legacyData.chatHistory) await db.chatHistory.bulkAdd(legacyData.chatHistory);
        
        // 3. Migrate Settings & Profile
        const settingsToMigrate = [
            'userProfile', 'settingsTable', 'categoryDetails', 
            'currentMarketValues', 'allocTargets', 'accounts',
            'fireTargetMonthly', 'templates', 'privacyMode', 
            'theme', 'geminiKey', 'groqKey', 'appPin', 'navCache'
        ];

        for (const key of settingsToMigrate) {
            if (legacyData[key] !== undefined) {
                await db.settings.put({ id: key, value: legacyData[key] });
            }
        }

        // Mark migration complete
        await db.settings.put({ id: 'migration_v1_complete', value: true });
        console.log("[DB] Migration successful.");
        
        // Optional: Keep localStorage as backup for now, but mark it
        localStorage.setItem('appHubInvestDb_migrated', 'true');
    } catch (err) {
        console.error("[DB] Migration failed:", err);
    }
}

// Global settings cache for fast access
let settingsCache = {};

async function loadSettings() {
    const allSettings = await db.settings.toArray();
    allSettings.forEach(s => {
        settingsCache[s.id] = s.value;
    });
}

async function getSetting(key, defaultValue = null) {
    if (settingsCache[key] !== undefined) return settingsCache[key];
    const s = await db.settings.get(key);
    return s ? s.value : defaultValue;
}

async function setSetting(key, value) {
    settingsCache[key] = value;
    await db.settings.put({ id: key, value });
}

export { db, migrateLegacyData, loadSettings, getSetting, setSetting };
