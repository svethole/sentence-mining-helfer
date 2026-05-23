// logger.js - Robuste Logging-Lösung für die Extension

class FileLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.storageKey = "extension_logs";
        this.isEnabled = true;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        await this.info("Logger initialized");
        this.initialized = true;
    }

    async log(level, message, data = null) {
        if (!this.isEnabled) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            data: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) : null
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        try {
            const result = await chrome.storage.local.get([this.storageKey]);
            let allLogs = result[this.storageKey] || [];
            allLogs.push(entry);
            if (allLogs.length > this.maxLogs) {
                allLogs = allLogs.slice(-this.maxLogs);
            }
            await chrome.storage.local.set({ [this.storageKey]: allLogs });
        } catch (e) {
            console.error("Logging failed:", e);
        }

        console.log(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`, data || "");
    }

    async info(message, data) {
        await this.log("info", message, data);
    }

    async error(message, data) {
        await this.log("error", message, data);
    }

    async debug(message, data) {
        await this.log("debug", message, data);
    }

    async warn(message, data) {
        await this.log("warn", message, data);
    }

    async exportLogs() {
        const result = await chrome.storage.local.get([this.storageKey]);
        const logs = result[this.storageKey] || [];
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `extension-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return logs;
    }

    async clearLogs() {
        this.logs = [];
        await chrome.storage.local.set({ [this.storageKey]: [] });
        await this.info("Logs cleared");
    }

    async getRecentLogs(count = 50) {
        const result = await chrome.storage.local.get([this.storageKey]);
        const logs = result[this.storageKey] || [];
        return logs.slice(-count);
    }
}

// Globale Instanz
window.logger = new FileLogger();

// Global Error Handler (kein await hier!)
window.addEventListener('error', (e) => {
    window.logger?.error("Global error", {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack
    }).catch(console.error);
});

window.addEventListener('unhandledrejection', (e) => {
    window.logger?.error("Unhandled promise rejection", {
        reason: e.reason?.message || e.reason,
        stack: e.reason?.stack
    }).catch(console.error);
});

// Initialisierung (ohne await auf Top-Level)
window.logger.init().catch(console.error);