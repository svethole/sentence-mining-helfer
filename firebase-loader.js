// firebase-loader.js - für lokale Firebase SDKs (KEINE importScripts mehr)

// Firebase initialisieren (globale firebase Variable wird von den SDKs bereitgestellt)
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// User ID Funktion
async function getUserId() {
    let result = await chrome.storage.sync.get(["firebaseUserId"]);
    if (!result.firebaseUserId) {
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.sync.set({ firebaseUserId: userId });
        return userId;
    }
    return result.firebaseUserId;
}

// Firebase API für andere Skripte
window.FirebaseAPI = {
    userId: null,

    async init() {
        this.userId = await getUserId();
        console.log("Firebase initialisiert für User:", this.userId);
        return this.userId;
    },

    async load() {
        if (!this.userId) await this.init();
        const snapshot = await db.collection('users').doc(this.userId)
        .collection('sentences')
        .orderBy('timestamp', 'desc')
        .get();

        const sentences = [];
        snapshot.forEach(doc => {
            sentences.push({
                id: parseInt(doc.id),
                           ...doc.data()
            });
        });
        return sentences;
    },

    async add(sentence) {
        if (!this.userId) await this.init();
        await db.collection('users').doc(this.userId)
        .collection('sentences')
        .doc(sentence.id.toString())
        .set({
            text: sentence.text,
            website: sentence.website,
            title: sentence.title,
            url: sentence.url,
            timestamp: sentence.timestamp,
            language: sentence.language,
            createdAt: new Date().toISOString()
        });
        return true;
    },

    async update(id, updates) {
        if (!this.userId) await this.init();
        await db.collection('users').doc(this.userId)
        .collection('sentences')
        .doc(id.toString())
        .update(updates);
        return true;
    },

    async delete(id) {
        if (!this.userId) await this.init();
        await db.collection('users').doc(this.userId)
        .collection('sentences')
        .doc(id.toString())
        .delete();
        return true;
    },

    async deleteAll() {
        if (!this.userId) await this.init();
        const snapshot = await db.collection('users').doc(this.userId)
        .collection('sentences')
        .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return true;
    },

    subscribe(callback) {
        if (!this.userId) {
            this.init().then(() => this.subscribe(callback));
            return;
        }

        return db.collection('users').doc(this.userId)
        .collection('sentences')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            const sentences = [];
            snapshot.forEach(doc => {
                sentences.push({
                    id: parseInt(doc.id),
                               ...doc.data()
                });
            });
            callback(sentences);
        });
    }
};

console.log("Firebase Loader geladen (lokale SDKs)");