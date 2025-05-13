<!-- script.js  — v10 FULL -->
/* ======== CONFIG ======== */
const STORAGE_KEY = "whiskey_tastings_v10";

/* 1)  Put your free key from https://barcodelookup.com/api  */
const API_KEY    = "su64ngx7t4ij1njke884k5em7kyj8c";

/* ========================= */

const { jsPDF }  = window.jspdf || {};

/* ----------  BARCODE SCANNING  ---------- */
const scanBtn    = document.getElementById("scanBtn");
const scannerWrap= document.getElementById("scannerWrap");
const videoElem  = document.getElementById("scannerVideo");
const closeScan  = document.getElementById("closeScan");
let scanCtrl     = null;

scanBtn.addEventListener("click", async () => {
  scannerWrap.style.display = "flex";
  try {
    scanCtrl = await window.BarcodeReader.decodeFromVideoDevice(
      null,
      videoElem,
      (result, err) => {
        if (result) {
          stopScanner();
          handleBarcode(result.getText());
        }
      }
    );
  } catch (e) {
    alert("Camera error: " + e);
    scannerWrap.style.display = "none";
  }
});
closeScan.addEventListener("click", stopScanner);

function stopScanner() {
  if (scanCtrl) scanCtrl.stop();
  scannerWrap.style.display = "none";
}

/* ----------  BARCODE LOOK‑UP  ---------- */
async function lookupBottle(code) {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    alert("Please add your BarcodeLookup API key in script.js");
    return null;
  }
  const url = `https://api.barcodelookup.com/v3/products?barcode=${code}&formatted=y&key=${API_KEY}`;
  try {
    const data = await fetch(url).then(r => r.json());
    if (!data.products || !data.products.length) return null;
    const p = data.products[0];
    return {
      name:        p.product_name || p.title || "",
      distillery:  p.brand || p.manufacturer || "",
      country:     p.country || "",
      style:       "",   // API rarely returns style
    };
  } catch {
    return null;
  }
}

async function handleBarcode(code) {
  const info = await lookupBottle(code);
  if (!info) {
    alert("Barcode not found online (“" + code + "”).");
    return;
  }
  if (info.name)       document.querySelector("[name=name]").value        = info.name;
  if (info.distillery) document.querySelector("[name=distillery]").value  = info.distillery;
  if (info.country)    document.querySelector("[name=country]").value     = info.country;
}

/* ----------  STORAGE HELPERS  ---------- */
function toBase64(file) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(file);
  });
}
const load  = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const save  = arr => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));

/* ----------  RENDER LIST  ---------- */
function render() {
  const list = document.getElementById("tastingsList");
  list.innerHTML = "";
  const data = load();
  if (!data.length) {
    list.innerHTML = "<p>No tastings yet.</p>";
    return;
  }
  data.forEach(t => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="entry-title">${t.name || "Unnamed"} (${t.score || "-"}/5)</div>
      <div><strong>Distillery:</strong> ${t.distillery || ""}</div>
      <div><strong>Country:</strong> ${t.country || ""}</div>
      <div><strong>Date:</strong> ${t.date || ""}</div>`;
    list.appendChild(div);
  });
}

/* ----------  FORM HANDLING  ---------- */
document.getElementById("scoreRange").addEventListener("input", e => {
  document.getElementById("scoreShow").textContent = e.target.value;
});

document.getElementById("tastingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    if (k === "photo" && v instanceof File && v.size) {
      obj[k] = await toBase64(v);
    } else obj[k] = v;
  }
  const arr = load();
  arr.unshift(obj);
  save(arr);
  e.target.reset();
  document.getElementById("scoreRange").value = 3;
  document.getElementById("scoreShow").textContent = 3;
  render();
});

/* ----------  EXPORTS & CLEAR  ---------- */
document.getElementById("exportBtn").addEventListener("click", () => {
  const data = load();
  if (!data.length) return alert("No tastings to export.");
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  data.forEach(o =>
    csvRows.push(headers.map(h => `"${(o[h] || "").toString().replace(/"/g, '""')}"`).join(","))
  );
  const blob = new Blob([csvRows.join("\\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "whiskey_tastings.csv";
  a.click();
});

document.getElementById("pdfBtn").addEventListener("click", () => {
  const data = load();
  if (!data.length) return alert("No tastings to export.");
  if (!jsPDF)      return alert("jsPDF library failed to load.");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;
  doc.setFontSize(16);
  doc.text("Whiskey Live 2025 – Tasting Notes", 15, y);
  y += 8;
  data.forEach((t, i) => {
    doc.setFontSize(12);
    doc.text(`${i + 1}. ${t.name || "Unnamed"} (${t.score || "-"}/5)`, 15, y);
    y += 6;
    const pairs = [
      ["Distillery", t.distillery],
      ["Country",    t.country],
      ["Date",       t.date]
    ];
    pairs.forEach(([l, v]) => {
      if (!v) return;
      doc.setFont(undefined, "bold");
      doc.text(l + ":", 15, y);
      doc.setFont(undefined, "normal");
      doc.text(v.toString(), 45, y);
      y += 5;
    });
    y += 4;
    if (y > 270 && i !== data.length - 1) {
      doc.addPage(); y = 15;
    }
  });
  doc.save("whiskey_tastings.pdf");
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Delete all tastings?")) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
});

/* ----------  INIT  ---------- */
if ("serviceWorker
