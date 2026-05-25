// firebase-loader.js - mit konfigurierbarer User-ID

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Firebase API für andere Skripte
window.FirebaseAPI = {
    userId: null,

    async init() {
        // Versuche, die konfigurierte User-ID zu laden
        const result = await chrome.storage.local.get(["configuredUserId"]);

        if (result.configuredUserId) {
            this.userId = result.configuredUserId;
            console.log("Firebase initialisiert mit konfigurierter User-ID:", this.userId);
            if (window.logger) {
                await window.logger.info("Firebase initialized with configured user ID", { userId: this.userId });
            }
        } else {
            // Keine Konfiguration gefunden -> Setup öffnen
            console.log("Keine User-ID konfiguriert, öffne Setup...");
            if (window.logger) {
                await window.logger.warn("No user ID configured, opening setup");
            }

            // Öffne das Setup-Fenster
            chrome.windows.create({
                url: chrome.runtime.getURL("setup.html"),
                                  type: "popup",
                                  width: 550,
                                  height: 550
            });

            // Wirf einen Fehler, der im Popup abgefangen wird
            throw new Error("NO_USER_ID_CONFIGURED");
        }

        return this.userId;
    },

    async getUserId() {
        if (!this.userId) {
            await this.init();
        }
        return this.userId;
    },

    async load() {
        if (!this.userId) await this.init();
        console.log("FirebaseAPI.load: Lade Sätze für User:", this.userId);

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
            console.log("FirebaseAPI.load: Geladen", sentences.length, "Sätze");
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
        console.log("FirebaseAPI.add: Füge Satz hinzu", { id: sentence.id });

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
            console.log("FirebaseAPI.add: Erfolgreich");
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
        console.log("FirebaseAPI.update", { id, updates });

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
        if (!this.userId) await this.init();
        console.log("FirebaseAPI.delete", { id });

        try {
            await db.collection('users').doc(this.userId)
            .collection('sentences')
            .doc(id.toString())
            .delete();
            console.log("FirebaseAPI.delete: Erfolgreich");
            return true;
        } catch (error) {
            console.error("FirebaseAPI.delete Fehler:", error);
            return false;
        }
    },

    async deleteAll() {
        if (!this.userId) await this.init();
        console.log("FirebaseAPI.deleteAll: Lösche alle Sätze");

        try {
            const snapshot = await db.collection('users').doc(this.userId)
            .collection('sentences')
            .get();

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log("FirebaseAPI.deleteAll: Erfolgreich");
            return true;
        } catch (error) {
            console.error("FirebaseAPI.deleteAll Fehler:", error);
            return false;
        }
    },

    // Zusätzliche Methoden für Migration
    async loadFromUserId(userId) {
        console.log("FirebaseAPI.loadFromUserId:", userId);

        try {
            const snapshot = await db.collection('users').doc(userId)
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
            console.error("loadFromUserId Fehler:", error);
            return [];
        }
    },

    async addToUserId(userId, sentence) {
        console.log("FirebaseAPI.addToUserId:", userId, sentence.id);

        try {
            await db.collection('users').doc(userId)
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
            console.error("addToUserId Fehler:", error);
            return false;
        }
    },

    async deleteAllFromUserId(userId) {
        console.log("FirebaseAPI.deleteAllFromUserId:", userId);

        try {
            const snapshot = await db.collection('users').doc(userId)
            .collection('sentences')
            .get();

            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            return true;
        } catch (error) {
            console.error("deleteAllFromUserId Fehler:", error);
            return false;
        }
    },

    subscribe(callback) {
        if (!this.userId) {
            this.init().then(() => this.subscribe(callback)).catch(err => {
                if (err.message === "NO_USER_ID_CONFIGURED") {
                    console.log("Setup required, subscription delayed");
                }
            });
            return;
        }

        console.log("FirebaseAPI.subscribe: Starte Echtzeit-Sync für User:", this.userId);

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
            console.log("FirebaseAPI.subscribe: Update mit", sentences.length, "Sätzen");
            callback(sentences);
        }, (error) => {
            console.error("FirebaseAPI.subscribe Fehler:", error);
            if (window.logger) {
                window.logger.error("Firebase subscription error", { message: error.message });
            }
        });
    }
};

console.log("Firebase Loader geladen (konfigurierbare Version)");