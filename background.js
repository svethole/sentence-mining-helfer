// Background Script - nur für Context Menu
// (Firebase wird im Popup verwendet, nicht hier)

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "addToSentenceMiner",
        title: "Zu Sentence Mining hinzufügen",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "addToSentenceMiner" && info.selectionText) {
        // Nachricht an Popup senden (falls offen)
        chrome.runtime.sendMessage({
            action: "addSentence",
            text: info.selectionText.trim(),
                                   tab: tab
        });

        // Direkt speichern über Storage (Fallback)
        saveSentenceLocally(info.selectionText.trim(), tab);
    }
});

async function saveSentenceLocally(selectedText, tab) {
    const timestamp = new Date();
    const formattedTimestamp = formatTimestamp(timestamp);

    let language = "unknown";
    try {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.documentElement.lang || navigator.language
        });
        language = result[0]?.result || "unknown";
    } catch(e) {}

    const sentence = {
        id: Date.now(),
        text: selectedText,
        website: new URL(tab.url).hostname.replace("www.", ""),
        title: tab.title,
        url: tab.url,
        timestamp: formattedTimestamp,
        language: language
    };

    // Temporär in local storage speichern (für späteren Import)
    const result = await chrome.storage.local.get(["pendingSentences"]);
    let pending = result.pendingSentences || [];
    pending.push(sentence);
    await chrome.storage.local.set({ pendingSentences: pending });

    chrome.action.setBadgeText({ text: "✓", tabId: tab.id });
    setTimeout(() => {
        chrome.action.setBadgeText({ text: "", tabId: tab.id });
    }, 1500);
}

function formatTimestamp(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}