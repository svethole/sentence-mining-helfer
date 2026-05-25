// setup.js - Erweiterte Version mit Änderungsfunktion

let currentDeviceId = null;
let isFirstTimeSetup = false;

document.addEventListener("DOMContentLoaded", async () => {
    await init();
    setupEventListeners();
    await loadCurrentConfig();
    await checkIfFirstTimeSetup();
});

async function init() {
    if (window.logger) {
        await window.logger.init();
    }

    // Geräte-ID anzeigen
    currentDeviceId = await getDeviceId();
    document.getElementById('deviceId').textContent = currentDeviceId;
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

async function checkIfFirstTimeSetup() {
    const result = await chrome.storage.local.get(["configuredUserId"]);
    if (!result.configuredUserId) {
        isFirstTimeSetup = true;
        document.getElementById('setupTitle').textContent = "🎉 Erste Schritte";
        document.getElementById('setupSubtitle').textContent = "Willkommen bei Sentence Mining Helper!";
        document.getElementById('changeWarning').style.display = "none";
    } else {
        isFirstTimeSetup = false;
        document.getElementById('setupTitle').textContent = "⚙️ Einstellungen";
        document.getElementById('setupSubtitle').textContent = "Ändere deine User-ID";
        document.getElementById('changeWarning').style.display = "block";
    }
}

async function loadCurrentConfig() {
    const result = await chrome.storage.local.get(["configuredUserId"]);
    if (result.configuredUserId) {
        document.getElementById('userId').value = result.configuredUserId;
        document.getElementById('currentUserId').textContent = result.configuredUserId;
        showStatus(`✅ Aktuelle User-ID: ${result.configuredUserId}`, 'success');
    } else {
        document.getElementById('currentUserId').textContent = "Noch nicht konfiguriert";
        showStatus("⚙️ Bitte konfiguriere deine User-ID", 'info');
    }
}

function setupEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveConfiguration);
    document.getElementById('generateBtn').addEventListener('click', generateRandomId);
    document.getElementById('resetBtn').addEventListener('click', resetConfiguration);
    document.getElementById('migrateBtn').addEventListener('click', migrateOldData);
}

async function saveConfiguration() {
    const userIdInput = document.getElementById('userId');
    let userId = userIdInput.value.trim();

    if (!userId) {
        showStatus("❌ Bitte gib eine User-ID ein", 'error');
        return;
    }

    // Erlaube nur alphanumerische Zeichen und Unterstriche
    userId = userId.replace(/[^a-zA-Z0-9_]/g, '_');

    // Prüfe, ob sich die ID ändert
    const oldResult = await chrome.storage.local.get(["configuredUserId"]);
    const oldUserId = oldResult.configuredUserId;
    const isChanging = oldUserId && oldUserId !== userId;

    if (isChanging) {
        const confirmChange = confirm(
            `⚠️ ACHTUNG: Du änderst deine User-ID von\n\n"${oldUserId}"\n\nzu\n\n"${userId}"\n\n` +
            `Deine bestehenden Sätze werden unter der neuen ID NICHT sichtbar sein!\n\n` +
            `Möchtest du die alten Daten in die neue ID migrieren?\n\n` +
            `(Ja = Daten migrieren, Nein = nur ID ändern)`
        );

        if (confirmChange) {
            // Migration durchführen
            await performMigration(oldUserId, userId);
        }
    }

    showStatus("💾 Speichere Konfiguration...", 'info');

    try {
        // Speichere in local storage
        await chrome.storage.local.set({
            configuredUserId: userId,
            userIdConfiguredAt: Date.now()
        });

        // Aktualisiere FirebaseAPI mit der neuen User-ID
        if (window.FirebaseAPI) {
            window.FirebaseAPI.userId = userId;
            window.FirebaseAPI.getUserId = async () => userId;
        }

        document.getElementById('currentUserId').textContent = userId;

        showStatus(`✅ Konfiguration gespeichert! Deine ID: ${userId}`, 'success');

        // Benachrichtige das Popup, dass es neu laden soll
        chrome.runtime.sendMessage({ action: "reloadPopup" });

        // Nach erfolgreicher Änderung automatisch schließen
        setTimeout(() => {
            if (!isChanging) {
                window.close();
            }
        }, 2000);

    } catch (error) {
        showStatus(`❌ Fehler: ${error.message}`, 'error');
        console.error(error);
    }
}

async function performMigration(oldUserId, newUserId) {
    showStatus("📦 Migriere Daten...", 'info');

    try {
        // Firebase initialisieren (falls nicht schon geschehen)
        if (!window.FirebaseAPI) {
            showStatus("❌ Firebase nicht verfügbar", 'error');
            return false;
        }

        // Alte Daten laden
        const oldSentences = await window.FirebaseAPI.loadFromUserId(oldUserId);

        if (oldSentences.length === 0) {
            showStatus("ℹ️ Keine Daten zum Migrieren gefunden", 'info');
            return true;
        }

        showStatus(`📦 Migriere ${oldSentences.length} Sätze...`, 'info');

        // In neue User-ID kopieren
        let migrated = 0;
        for (const sentence of oldSentences) {
            await window.FirebaseAPI.addToUserId(newUserId, sentence);
            migrated++;
            if (migrated % 10 === 0) {
                showStatus(`📦 Migriere... ${migrated}/${oldSentences.length}`, 'info');
            }
        }

        showStatus(`✅ Migration abgeschlossen! ${migrated} Sätze migriert.`, 'success');

        // Optional: Alte Daten löschen?
        const deleteOld = confirm("Möchtest du die alten Daten (unter der vorherigen ID) löschen?");
        if (deleteOld) {
            await window.FirebaseAPI.deleteAllFromUserId(oldUserId);
            showStatus("🗑️ Alte Daten gelöscht", 'success');
        }

        return true;

    } catch (error) {
        console.error("Migrationsfehler:", error);
        showStatus(`❌ Migrationsfehler: ${error.message}`, 'error');
        return false;
    }
}

async function migrateOldData() {
    const oldUserId = document.getElementById('userId').value.trim();
    if (!oldUserId) {
        showStatus("❌ Bitte gib die alte User-ID ein", 'error');
        return;
    }

    const newResult = await chrome.storage.local.get(["configuredUserId"]);
    const newUserId = newResult.configuredUserId;

    if (!newUserId) {
        showStatus("❌ Keine neue User-ID konfiguriert", 'error');
        return;
    }

    if (oldUserId === newUserId) {
        showStatus("❌ Alte und neue ID sind identisch", 'error');
        return;
    }

    const confirm = window.confirm(
        `⚠️ Möchtest du wirklich Daten von\n\n"${oldUserId}"\n\nnach\n\n"${newUserId}"\n\nmigrieren?`
    );

    if (confirm) {
        await performMigration(oldUserId, newUserId);
    }
}

function generateRandomId() {
    const adjectives = ['fast', 'brave', 'calm', 'eager', 'happy', 'kind', 'smart', 'wild'];
    const nouns = ['miner', 'collector', 'saver', 'hunter', 'gatherer', 'finder'];
    const randomNum = Math.floor(Math.random() * 1000);

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    const randomId = `${adj}_${noun}_${randomNum}`;
    document.getElementById('userId').value = randomId;
    showStatus(`🎲 Vorschlag: ${randomId}`, 'info');
}

async function resetConfiguration() {
    if (confirm("⚠️ ACHTUNG: Das Zurücksetzen löscht deine lokale Konfiguration.\n\nDeine Daten in der Cloud bleiben erhalten.\n\nMöchtest du fortfahren?")) {
        await chrome.storage.local.remove(["configuredUserId", "userIdConfiguredAt"]);
        document.getElementById('userId').value = '';
        document.getElementById('currentUserId').textContent = "Noch nicht konfiguriert";
        showStatus("🔄 Konfiguration zurückgesetzt. Du kannst jetzt eine neue ID eingeben.", 'info');

        // FirebaseAPI zurücksetzen
        if (window.FirebaseAPI) {
            window.FirebaseAPI.userId = null;
        }
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    setTimeout(() => {
        if (statusDiv.textContent === message) {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }
    }, 5000);
}