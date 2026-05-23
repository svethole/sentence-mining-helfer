// firebase-loader.js - für lokale Firebase SDKs

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

        // Logger verwenden, falls verfügbar
        if (window.logger) {
            await window.logger.info("Firebase initialized", { userId: this.userId });
        }
        return this.userId;
    },

    async load() {
        if (!this.userId) await this.init();

        try {
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
        } catch (error) {
            console.error("FirebaseAPI.load Fehler:", error);
            if (window.logger) {
                await window.logger.error("FirebaseAPI.load error", { message: error.message });
            }
            return [];
        }
    },

    async add(sentence) {
        if (!this.userId) await this.init();

        try {
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
        } catch (error) {
            console.error("FirebaseAPI.add Fehler:", error);
            if (window.logger) {
                await window.logger.error("FirebaseAPI.add error", { message: error.message });
            }
            return false;
        }
    },

    async update(id, updates) {
        if (!this.userId) await this.init();

        try {
            await db.collection('users').doc(this.userId)
            .collection('sentences')
            .doc(id.toString())
            .update(updates);
            return true;
        } catch (error) {
            console.error("FirebaseAPI.update Fehler:", error);
            return false;
        }
    },

    async delete(id) {
        const deleteId = Date.now();

        if (!this.userId) {
            await this.init();
        }

        try {
            const docRef = db.collection('users').doc(this.userId)
            .collection('sentences')
            .doc(id.toString());

            // Timeout, um zu sehen ob es hängt
            const deletePromise = docRef.delete();
            const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("DELETE TIMEOUT nach 5 Sekunden")), 5000)
            );

            await Promise.race([deletePromise, timeoutPromise]);

            return true;

        } catch (error) {
            console.error(`FirebaseAPI.delete[${deleteId}] - FEHLER:`, error);
            if (window.logger) {
                await window.logger.error(`FirebaseAPI.delete Fehler`, {
                    id,
                    message: error.message,
                    stack: error.stack
                });
            }
            return false;
        }
    },

    async deleteAll() {
        if (!this.userId) await this.init();

        try {
            const snapshot = await db.collection('users').doc(this.userId)
            .collection('sentences')
            .get();

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            return true;
        } catch (error) {
            console.error("FirebaseAPI.deleteAll Fehler:", error);
            return false;
        }
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
        }, (error) => {
            console.error("FirebaseAPI.subscribe Fehler:", error);
        });
    }
};

console.log("Firebase Loader geladen (lokale SDKs)");