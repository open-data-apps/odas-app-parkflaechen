let configData = {}; // Globale Variable für die Konfigurationsdaten

document.addEventListener("DOMContentLoaded", async () => {
  const configUrl = getConfigUrl();
  startAutoRefresh();
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  try {
    configData = await fetchConfig(configUrl); // Zuweisung zu globaler Variable
    updatePageContent();
    loadPage("startseite");
  } catch (err) {
    console.error("Fehler:", err);
  }
  setupBurgerMenu();
});

function getConfigUrl() {
  const urlString = window.location.href;
  const url = new URL(urlString);
  let configUrl = `${urlString}config`;
  /*
  if (["127.0.0.1", "localhost"].includes(url.hostname)) {
    configUrl = "../odas-config/config.json";
  } else if (["10.0.0.142"].includes(url.hostname)) {
    configUrl = "/odas-config/config.json";
  }
  */
  return configUrl;
}

/* die Funktion macht aus Multiline-Strings (enden mit einem \)
 * Single Line Strings und dann ein normales Json
 */
function normalizeJson(extendedJson = "") {
  console.log(extendedJson);
  const cleanedString = extendedJson.replace(/\\\s*\n\s*/g, "");
  return JSON.parse(cleanedString);
}

/* die Funktion macht aus Multiline-Values (Array of Strings)
 * Single Line Values
 */
function flattenJson(jsonObj) {
  const result = {};
  for (const key in jsonObj) {
    if (!jsonObj.hasOwnProperty(key)) continue;
    const value = jsonObj[key];
    // wenn ein Value aus einem Array of Strings besteht...
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      // ...verbinde die Strings zu einem einzigen String
      result[key] = value.join("");
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function fetchConfig(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("kann Konfiguration nicht laden");
  return flattenJson(await response.json());
  //return normalizeJson(await response.text());
}

function updatePageContent() {
  const {
    titel = "",
    seitentitel = "",
    icon = "logo.png",
    fusszeile = "&copy; 2025 ODAS Karten App. Alle Rechte vorbehalten.",
  } = configData;

  const elementMappings = {
    "title-text": titel,
    "tab-title": seitentitel,
    "logo-icon": icon,
    "footer-text": fusszeile,
  };

  Object.entries(elementMappings).forEach(([id, content]) => {
    const element = document.getElementById(id);
    if (id === "logo-icon") {
      element.src = content;
    } else {
      element.textContent = content;
    }
  });
}

async function loadPage(page) {
  let content;
  switch (page) {
    case "startseite":
      app();
      break;
    case "kontakt":
      content = createPageContent("Kontakt", configData.kontakt);
      break;
    case "impressum":
      content = createPageContent("Impressum", configData.impressum);
      break;
    case "datenschutz":
      content = createPageContent("Datenschutz", configData.datenschutz);
      break;
    case "beschreibung":
      content = createPageContent("Über diese App", configData.beschreibung);
      break;
    default:
      content = createPageContent("Fehler", "Seite nicht gefunden.");
  }
  if (page === "startseite") {
  } else {
    document.getElementById("main-content").innerHTML = content;
    document.getElementById("sidebartoggle").style.visibility = "hidden";
    poiSidebar.style.display = "none";
  }
}

function createPageContent(title, content = "Informationen nicht verfügbar.") {
  return `<div class="col" id="secondarySites"><h2>${title}</h2><p>${content}</p></div>`;
}

function setupBurgerMenu() {
  document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
    const pageName =
      link.getAttribute("data-page") ||
      link.getAttribute("href").replace("#", "").trim();
    if (pageName) {
      // Stelle sicher, dass pageName gültig ist
      link.addEventListener("click", (event) => {
        event.preventDefault(); // Verhindere das standardmäßige Link-Verhalten
        loadPage(pageName); // Lade die entsprechende Seite

        const offcanvasNavbar = document.getElementById("offcanvasNavbar");
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasNavbar);

        if (offcanvas && offcanvasNavbar.classList.contains("show")) {
          offcanvas.hide();
        }
      });
    }
  });
}
