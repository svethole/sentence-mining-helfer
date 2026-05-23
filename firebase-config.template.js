// Firebase-Konfiguration - HIER DEINE EIGENEN WERTE EINFÜGEN!
const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
};

// Firestore Collections
const COLLECTION_USERS = "users";
const COLLECTION_SENTENCES = "sentences";

// Extension-spezifische ID (für auth bei mehreren Geräten)
async function getUserId() {
    // Verwende Chrome's Sync Storage für eine benutzerdefinierte ID
    let result = await chrome.storage.sync.get(["firebaseUserId"]);
    if (!result.firebaseUserId) {
        // Generiere eindeutige ID
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.sync.set({ firebaseUserId: userId });
        return userId;
    }
    return result.firebaseUserId;
}