// info_overlay.js
let currentSentences = [];
let firebaseInitialized = false;

document.addEventListener("DOMContentLoaded", async () => {
    await init();
    await loadAllInfo();
    setupEventListeners();
    setupSectionToggles();
});

async function init() {
    if (window.logger) {
        await window.logger.init();
        await window.logger.info("Info overlay started");
    }

    if (window.FirebaseAPI) {
        await FirebaseAPI.init();
        firebaseInitialized = true;
        currentSentences = await FirebaseAPI.load();
    }
}

function setupSectionToggles() {
    const toggles = document.querySelectorAll('.section-header');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const sectionId = toggle.dataset.section;
            const content = document.getElementById(sectionId);
            const icon = toggle.querySelector('.toggle-icon');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '▼';

                if (sectionId === 'storageContent') {
                    loadStorageContent();
                }
            } else {
                content.style.display = 'none';
                icon.textContent = '▶';
            }
        });
    });
}

function setupEventListeners() {
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const elementId = btn.dataset.copy;
            copyToClipboardById(elementId);
        });
    });

    // Export Logs
    document.getElementById('exportLogsBtn')?.addEventListener('click', async () => {
        if (window.logger) {
            await window.logger.exportLogs();
            showStatus("📤 Logs exportiert");
        } else {
            showStatus("❌ Logger nicht verfügbar");
        }
    });

    // Clear Logs
    document.getElementById('clearLogsBtn')?.addEventListener('click', async () => {
        if (confirm("Alle Logs wirklich löschen?")) {
            await window.logger?.clearLogs();
            showStatus("✅ Logs gelöscht");
        }
    });

    // Force Resync
    document.getElementById('forceResyncBtn')?.addEventListener('click', async () => {
        showStatus("🔄 Erzwinge Resynchronisation...");
        currentSentences = await FirebaseAPI.load();
        document.getElementById('sentenceCount').textContent = currentSentences.length;
        showStatus(`✅ Resync abgeschlossen: ${currentSentences.length} Sätze`);
    });

    // Test Notification
    document.getElementById('testNotificationBtn')?.addEventListener('click', () => {
        if (Notification.permission === 'granted') {
            new Notification('Sentence Mining Helper', {
                body: 'Debug-Benachrichtigung funktioniert!',
                icon: 'icons/icon128.png'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Sentence Mining Helper', {
                        body: 'Benachrichtigungen sind jetzt aktiviert!',
                        icon: 'icons/icon128.png'
                    });
                }
            });
        }
        showStatus("🔔 Test-Benachrichtigung gesendet");
    });

    // Copy all info
    document.getElementById('copyAllInfoBtn')?.addEventListener('click', async () => {
        const info = await generateSystemReport();
        await copyToClipboardText(info);
        showStatus("📋 Alle Infos kopiert");
    });

    // Export System Report
    document.getElementById('exportSystemReportBtn')?.addEventListener('click', async () => {
        const report = await generateSystemReport();
        const blob = new Blob([report], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-report-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus("📄 System-Report exportiert");
    });
}

async function loadAllInfo() {
    await loadBasicInfo();
    await loadSyncStatus();
    await loadDatabaseStats();
    await loadFirebaseConfig();
}

async function loadBasicInfo() {
    const extensionId = chrome.runtime.id;
    document.getElementById('extensionId').textContent = extensionId;

    try {
        const manifest = chrome.runtime.getManifest();
        if (manifest.key) {
            const shortKey = manifest.key.substring(0, 50) + "...";
            document.getElementById('publicKey').textContent = shortKey;
            document.getElementById('publicKey').title = manifest.key;
        } else {
            document.getElementById('publicKey').textContent = "❌ Kein Public Key gesetzt";
        }
        document.getElementById('extensionVersion').textContent = manifest.version || "unknown";
    } catch(e) {
        document.getElementById('publicKey').textContent = "Fehler beim Lesen";
    }

    if (window.FirebaseAPI && window.FirebaseAPI.userId) {
        document.getElementById('firebaseUserId').textContent = window.FirebaseAPI.userId;
    } else {
        document.getElementById('firebaseUserId').textContent = "❌ Nicht initialisiert";
    }

    const deviceId = await getDeviceId();
    document.getElementById('deviceId').textContent = deviceId;

    const browserInfo = `${navigator.userAgent.split(' ').slice(-3).join(' ')}`;
    document.getElementById('browserInfo').textContent = browserInfo;
}

async function getDeviceId() {
    let result = await chrome.storage.local.get(["deviceId"]);
    if (!result.deviceId) {
        const id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        await chrome.storage.local.set({ deviceId: id });
        return id;
    }
    return result.deviceId;
}

async function loadSyncStatus() {
    try {
        const testKey = "_sync_test_" + Date.now();
        await chrome.storage.sync.set({ [testKey]: "test" });
        const result = await chrome.storage.sync.get([testKey]);
        if (result[testKey] === "test") {
            document.getElementById('syncStatus').innerHTML = "✅ Funktioniert";
            await chrome.storage.sync.remove([testKey]);
        } else {
            document.getElementById('syncStatus').innerHTML = "⚠️ Funktioniert nicht richtig";
        }
    } catch(e) {
        document.getElementById('syncStatus').innerHTML = `❌ Fehler: ${e.message}`;
    }

    if (firebaseInitialized && window.FirebaseAPI) {
        document.getElementById('firebaseStatus').innerHTML = "✅ Verbunden";
    } else {
        document.getElementById('firebaseStatus').innerHTML = "❌ Nicht verbunden";
    }

    const logs = await window.logger?.getRecentLogs(20) || [];
    const syncLogs = logs.filter(l => l.message && l.message.includes("Synchronisiert"));
    if (syncLogs.length > 0) {
        const last = new Date(syncLogs[0].timestamp);
        const hoursAgo = Math.floor((Date.now() - last) / 3600000);
        document.getElementById('lastSync').textContent = `${hoursAgo} Stunden her (${last.toLocaleTimeString()})`;
    } else {
        document.getElementById('lastSync').textContent = "Keine Sync-Logs gefunden";
    }
}

async function loadDatabaseStats() {
    document.getElementById('sentenceCount').textContent = currentSentences.length;

    try {
        const result = await chrome.storage.sync.get(null);
        const size = JSON.stringify(result).length;
        const kb = (size / 1024).toFixed(1);
        document.getElementById('storageUsed').textContent = `${kb} KB / 8 KB`;
    } catch(e) {
        document.getElementById('storageUsed').textContent = "❌ Fehler";
    }

    if (currentSentences.length > 0) {
        const timestamps = currentSentences.map(s => {
            const parts = s.timestamp.split(/[.:\s]/);
            const date = new Date(parts[2], parts[1]-1, parts[0], parts[3], parts[4]);
            return date;
        }).filter(d => !isNaN(d));

        if (timestamps.length > 0) {
            const oldest = Math.min(...timestamps);
            const newest = Math.max(...timestamps);
            const oldestDays = Math.floor((Date.now() - oldest) / 86400000);
            const newestHours = Math.floor((Date.now() - newest) / 3600000);

            document.getElementById('oldestSentence').textContent = `${oldestDays} Tage`;
            document.getElementById('newestSentence').textContent = `${newestHours} Std`;
        }
    }
}

async function loadFirebaseConfig() {
    if (typeof firebaseConfig === 'undefined') {
        document.getElementById('firebaseConfigTree').innerHTML = "❌ Firebase Konfiguration nicht gefunden";
        return;
    }

    const tree = renderTreeView(firebaseConfig);
    document.getElementById('firebaseConfigTree').innerHTML = tree;
}

function renderTreeView(obj, level = 0) {
    if (!obj) return "<span style='color:#858585'>null</span>";

    if (typeof obj === 'string') {
        return `<span class="tree-value">"${escapeHtml(obj)}"</span>`;
    }
    if (typeof obj === 'number') {
        return `<span class="tree-number">${obj}</span>`;
    }
    if (typeof obj === 'boolean') {
        return `<span class="tree-boolean">${obj}</span>`;
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) return "<span class='tree-key'>[]</span>";
        return `[...]`;
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return "<span class='tree-key'>{}</span>";

        const maskedKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

        let html = '<div>';
        for (let key of keys) {
            const value = obj[key];
            let displayValue = value;
            if (maskedKeys.includes(key) && typeof value === 'string' && value.length > 8) {
                displayValue = value.substring(0, 4) + '...' + value.substring(value.length - 4);
            }
            html += `
            <div class="tree-node">
            <span class="tree-key">${escapeHtml(key)}</span>:
            ${renderTreeView(displayValue, level + 1)}
            </div>
            `;
        }
        html += '</div>';
        return html;
    }
    return String(obj);
}

async function loadStorageContent() {
    try {
        const result = await chrome.storage.sync.get(null);
        const tree = renderTreeView(result);
        document.getElementById('storageTree').innerHTML = tree || "<span style='color:#858585'>Leer</span>";
    } catch(e) {
        document.getElementById('storageTree').innerHTML = `❌ Fehler: ${e.message}`;
    }
}

async function generateSystemReport() {
    const lines = [];
    lines.push("=== SENTENCE MINING HELPER - SYSTEM REPORT ===");
    lines.push(`Erstellt: ${new Date().toLocaleString()}`);
    lines.push("");

    lines.push("--- EXTENSION INFO ---");
    lines.push(`Extension ID: ${chrome.runtime.id}`);
    const manifest = chrome.runtime.getManifest();
    lines.push(`Version: ${manifest.version}`);
    lines.push(`Public Key: ${manifest.key || "Nicht gesetzt"}`);
    lines.push("");

    lines.push("--- DEVICE INFO ---");
    lines.push(`Device ID: ${await getDeviceId()}`);
    lines.push(`Browser: ${navigator.userAgent}`);
    lines.push(`Platform: ${navigator.platform}`);
    lines.push("");

    lines.push("--- FIREBASE INFO ---");
    lines.push(`User ID: ${window.FirebaseAPI?.userId || "Nicht initialisiert"}`);
    lines.push(`Sentences: ${currentSentences.length}`);
    lines.push("");

    lines.push("--- SYNC INFO ---");
    try {
        const result = await chrome.storage.sync.get(null);
        const size = JSON.stringify(result).length;
        lines.push(`Storage Used: ${(size/1024).toFixed(1)} KB / 8 KB`);
    } catch(e) {
        lines.push(`Storage Error: ${e.message}`);
    }
    lines.push("");

    lines.push("--- LAST 10 LOGS ---");
    const logs = await window.logger?.getRecentLogs(10) || [];
    logs.forEach(log => {
        lines.push(`[${log.timestamp}] ${log.level}: ${log.message}`);
    });

    return lines.join('\n');
}

async function copyToClipboardById(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        await copyToClipboardText(element.textContent);
        showStatus(`✅ "${elementId}" kopiert`);
    }
}

async function copyToClipboardText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch(err) {
        showStatus("❌ Fehler beim Kopieren");
    }
}

function showStatus(message) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    setTimeout(() => {
        if (statusDiv.textContent === message) {
            statusDiv.textContent = '';
        }
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}