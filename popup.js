// popup.js - OHNE Module, alles global
let currentSentences = [];

// Initial laden
document.addEventListener("DOMContentLoaded", async () => {
    // Firebase initialisieren
    if (window.FirebaseAPI) {
        await FirebaseAPI.init();
        showStatus("☁️ Firebase verbunden");

        // Echtzeit-Sync
        FirebaseAPI.subscribe((sentences) => {
            currentSentences = sentences;
            renderTable();
            updateStatus();
        });
    }

    // Gespeicherte Sätze laden
    await loadAndRender();

    // Pending Sentences aus background.js importieren
    await importPendingSentences();

    // Buttons
    document.getElementById("copyAllTextsBtn").addEventListener("click", copyAllTexts);
    document.getElementById("copyFullTableBtn").addEventListener("click", copyFullTable);
    document.getElementById("exportJsonBtn").addEventListener("click", exportToJSON);
    document.getElementById("importJsonBtn").addEventListener("click", () => {
        document.getElementById("importFileInput").click();
    });
    document.getElementById("importFileInput").addEventListener("change", importFromJSON);
    document.getElementById("deleteAllBtn").addEventListener("click", deleteAllSentences);
    document.getElementById("refreshBtn").addEventListener("click", () => loadAndRender());
});

async function importPendingSentences() {
    const result = await chrome.storage.local.get(["pendingSentences"]);
    const pending = result.pendingSentences || [];

    if (pending.length > 0) {
        showStatus(`📥 Importiere ${pending.length} gespeicherte Sätze...`);
        for (const sentence of pending) {
            await FirebaseAPI.add(sentence);
        }
        await chrome.storage.local.remove("pendingSentences");
        await loadAndRender();
        showStatus(`✅ ${pending.length} Sätze importiert`);
    }
}

async function loadAndRender() {
    if (window.FirebaseAPI) {
        currentSentences = await FirebaseAPI.load();
    }
    renderTable();
    updateStatus();
}

function updateStatus() {
    const statusDiv = document.getElementById("status");
    statusDiv.innerHTML = `☁️ Cloud: ${currentSentences.length} Sätze | Echtzeit-Sync aktiv`;
}

function renderTable() {
    const tbody = document.getElementById("tableBody");

    if (currentSentences.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">Keine Sätze gespeichert. Markiere Text → Rechtsklick → "Zu Sentence Mining hinzufügen"</td></tr>';
        return;
    }

    tbody.innerHTML = "";

    currentSentences.forEach((sentence) => {
        const row = tbody.insertRow();
        row.dataset.id = sentence.id;

        // Aktionen
        const actionCell = row.insertCell(0);
        actionCell.className = "action-buttons";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋";
        copyBtn.className = "copy-btn";
        copyBtn.onclick = () => copyToClipboard(sentence.text);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️";
        deleteBtn.className = "delete-row-btn";
        deleteBtn.onclick = () => deleteSentence(sentence.id);

        actionCell.appendChild(copyBtn);
        actionCell.appendChild(deleteBtn);

        // Text
        const textCell = row.insertCell(1);
        textCell.textContent = sentence.text;
        textCell.setAttribute('data-fulltext', sentence.text);
        textCell.title = sentence.text;
        textCell.ondblclick = () => makeEditable(textCell, "text", sentence.id);

        // Website
        const websiteCell = row.insertCell(2);
        websiteCell.textContent = sentence.website;
        websiteCell.ondblclick = () => makeEditable(websiteCell, "website", sentence.id);

        // Titel
        const titleCell = row.insertCell(3);
        titleCell.textContent = sentence.title;
        titleCell.ondblclick = () => makeEditable(titleCell, "title", sentence.id);

        // Link
        const linkCell = row.insertCell(4);
        linkCell.className = "url-cell";
        const link = document.createElement("a");
        link.href = sentence.url;
        link.textContent = sentence.url.length > 50 ? sentence.url.substring(0, 47) + "..." : sentence.url;
        link.target = "_blank";
        linkCell.appendChild(link);

        // Datum
        const dateCell = row.insertCell(5);
        dateCell.textContent = sentence.timestamp;

        // Rechtsklick-Menü
        row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            showContextMenu(e, sentence, row);
        });
    });
}

function showContextMenu(event, sentence, row) {
    const existingMenu = document.querySelector(".custom-context-menu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.className = "custom-context-menu";
    menu.style.position = "fixed";
    menu.style.left = event.pageX + "px";
    menu.style.top = event.pageY + "px";
    menu.style.background = "white";
    menu.style.border = "1px solid #ccc";
    menu.style.borderRadius = "4px";
    menu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    menu.style.zIndex = "10000";

    const options = [
        { label: "Text kopieren", action: () => copyToClipboard(sentence.text) },
        { label: "Website kopieren", action: () => copyToClipboard(sentence.website) },
        { label: "Titel kopieren", action: () => copyToClipboard(sentence.title) },
        { label: "Link kopieren", action: () => copyToClipboard(sentence.url) },
        { label: "Datum kopieren", action: () => copyToClipboard(sentence.timestamp) },
        { label: "---", action: null },
        { label: "Komplette Zeile kopieren (CSV)", action: () => copyRowAsCSV(sentence) },
        { label: "---", action: null },
        { label: "Zeile exportieren (JSON)", action: () => exportSingleSentence(sentence) },
        { label: "Zeile löschen", action: () => deleteSentence(sentence.id), danger: true }
    ];

    options.forEach(opt => {
        if (opt.label === "---") {
            const hr = document.createElement("hr");
            hr.style.margin = "4px 0";
            menu.appendChild(hr);
            return;
        }

        const item = document.createElement("div");
        item.textContent = opt.label;
        item.style.padding = "6px 12px";
        item.style.cursor = "pointer";
        item.style.fontSize = "12px";
        if (opt.danger) item.style.color = "#e74c3c";
        item.onmouseover = () => item.style.background = "#f0f0f0";
        item.onmouseout = () => item.style.background = "white";
        item.onclick = () => {
            if (opt.action) opt.action();
            menu.remove();
        };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener("click", function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener("click", closeMenu);
            }
        });
    }, 0);
}

async function makeEditable(cell, field, id) {
    const originalText = cell.textContent;
    cell.contentEditable = "true";
    cell.style.background = "#fff8e7";
    cell.focus();

    const saveEdit = async () => {
        cell.contentEditable = "false";
        cell.style.background = "";
        const newText = cell.textContent.trim();

        if (newText !== originalText && newText !== "") {
            await FirebaseAPI.update(id, { [field]: newText });
            showStatus("✅ Gespeichert");
        }
    };

    cell.addEventListener("blur", saveEdit, { once: true });
    cell.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            cell.blur();
        }
    }, { once: true });
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showStatus("✅ In Zwischenablage kopiert!");
    } catch (err) {
        showStatus("❌ Fehler beim Kopieren");
    }
}

function copyRowAsCSV(sentence) {
    const row = [sentence.text, sentence.website, sentence.title, sentence.url, sentence.timestamp];
    copyToClipboard(row.join(";"));
}

async function copyAllTexts() {
    const texts = currentSentences.map(s => s.text).join("\n");
    await copyToClipboard(texts);
}

async function copyFullTable() {
    const headers = ["Text", "Website", "Titel", "Link", "Datum"];
    const rows = currentSentences.map(s => [s.text, s.website, s.title, s.url, s.timestamp]);
    const csv = [headers, ...rows].map(row => row.join(";")).join("\n");
    await copyToClipboard(csv);
}

async function exportToJSON() {
    const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        count: currentSentences.length,
        sentences: currentSentences
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const filename = `sentence-mining-backup-${timestamp}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(`💾 ${currentSentences.length} Sätze exportiert`);
}

function exportSingleSentence(sentence) {
    const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        count: 1,
        sentences: [sentence]
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `sentence-${sentence.id}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showStatus("💾 Einzelner Satz exportiert");
}

async function importFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const importData = JSON.parse(text);

        let newSentences = importData.sentences || importData;
        if (!Array.isArray(newSentences)) {
            throw new Error("Ungültiges Format");
        }

        let importCount = 0;
        for (const sentence of newSentences) {
            if (sentence.text && sentence.url) {
                const newId = Date.now() + importCount;
                await FirebaseAPI.add({
                    ...sentence,
                    id: newId
                });
                importCount++;
            }
        }

        showStatus(`✅ ${importCount} Sätze importiert`);
        await loadAndRender();
    } catch (error) {
        showStatus(`❌ Import fehlgeschlagen: ${error.message}`);
    }

    document.getElementById("importFileInput").value = "";
}

async function deleteSentence(id) {
    if (confirm("Diese Zeile wirklich löschen?")) {
        await FirebaseAPI.delete(id);
        showStatus("✅ Gelöscht");
    }
}

async function deleteAllSentences() {
    if (confirm("⚠️ ALLE Sätze löschen? Diese Aktion kann nicht rückgängig gemacht werden!")) {
        await FirebaseAPI.deleteAll();
        showStatus("✅ Alle Sätze gelöscht");
    }
}

function showStatus(message) {
    const status = document.getElementById("status");
    status.innerHTML = message;
    setTimeout(() => {
        if (status.innerHTML === message) {
            updateStatus();
        }
    }, 3000);
}