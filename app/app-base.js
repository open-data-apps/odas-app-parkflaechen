let configData = {}; // Globale Variable für die Konfigurationsdaten

document.addEventListener("DOMContentLoaded", async () => {
  const configUrl = getConfigUrl();
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = "";
  }
  try {
    configData = await fetchConfig(configUrl); // Zuweisung zu globaler Variable
    addToHead();
    updatePageContent();
    startAutoRefresh();
    // Überprüfe, ob ein Custom CSS Code oder Custom Branding CSS File in der Config vorhanden ist
    if (
      configData.brandingCSSFile &&
      configData.brandingCSSFile.trim().length > 0
    ) {
      const linkElem = document.createElement("link");
      linkElem.rel = "stylesheet";
      linkElem.href = configData.brandingCSSFile;
      document.head.appendChild(linkElem);
      console.log("Custom Branding CSS wurde angewendet.");
    } else if (
      configData.brandingCSS &&
      configData.brandingCSS.trim().length > 0
    ) {
      const customStyle = document.createElement("style");
      customStyle.innerHTML = configData.brandingCSS;
      document.head.appendChild(customStyle);
      console.log("Custom Branding CSS wurde angewendet.");
    } else {
      console.log("Kein Custom Branding CSS in der Config gefunden.");
    }
    // Router initialisieren
    window.addEventListener("hashchange", handleRouting);

    const initialPage = getPageFromHash();
    if (window.location.hash !== `#${initialPage}`) {
      window.location.hash = `#${initialPage}`;
    } else {
      handleRouting();
    }
  } catch (err) {
    console.error("Fehler:", err);
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="alert alert-danger my-4" role="alert">
          <h4 class="alert-heading">Fehler beim Laden der App</h4>
          <p>Die Konfigurationsdatei der App konnte nicht geladen oder verarbeitet werden.</p>
          <hr>
          <p class="mb-0">Details: ${err.message}</p>
        </div>
      `;
    }
  }
  setupBurgerMenu();
});

function getConfigUrl() {
  const url = new URL(window.location.href);

  // Clean query and hash
  url.search = "";
  url.hash = "";

  // Ensure the pathname refers to the directory and not a filename (e.g. index.html)
  let pathname = url.pathname;
  if (!pathname.endsWith("/")) {
    const lastSlashIndex = pathname.lastIndexOf("/");
    if (lastSlashIndex !== -1) {
      pathname = pathname.substring(0, lastSlashIndex + 1);
    }
  }

  let configUrl = url.origin + pathname + "config";

  if (["127.0.0.1", "localhost"].includes(url.hostname)) {
    configUrl = "../odas-config/config.json";
  }
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
    fusszeile = "© 2026 ODAS App. Alle Rechte vorbehalten.",
  } = configData;

  const elementMappings = {
    "title-text": titel,
    "tab-title": seitentitel,
    "logo-icon": icon,
    "footer-text": fusszeile,
  };

  Object.entries(elementMappings).forEach(([id, content]) => {
    const element = document.getElementById(id);
    if (!element) return; // Existenz-Check
    if (id === "logo-icon") {
      element.src = content;
    } else if (id === "footer-text") {
      element.innerHTML = content;
    } else {
      element.textContent = content;
    }
  });
}

async function loadPage(page) {
  // Clean up Leaflet map if leaving startseite
  if (page !== "startseite") {
    if (typeof map !== 'undefined' && map) {
      try {
        map.remove();
      } catch (e) {
        console.warn("Fehler beim Entfernen der Leaflet-Karte:", e);
      }
      map = null;
    }
  }

  let content;
  const mainContent = document.getElementById("main-content");
  const poiSidebar = document.getElementById("poiSidebar");
  const sidebartoggle = document.getElementById("sidebartoggle");
  switch (page) {
    case "startseite":
      content = app(configData, mainContent);
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
    // app() rendert eigenständig in #main-content und blendet die POI-Sidebar ein
    if (sidebartoggle) sidebartoggle.style.visibility = "";
  } else {
    if (content) {
      mainContent.innerHTML = content;
    }
    if (sidebartoggle) sidebartoggle.style.visibility = "hidden";
    if (poiSidebar) poiSidebar.style.display = "none";
  }
}

function createPageContent(title, content = "Informationen nicht verfügbar.") {
  return `<div class="col" id="secondarySites"><h2>${title}</h2><p>${content}</p></div>`;
}

function setupBurgerMenu() {
  document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    const pageName =
      link.getAttribute("data-page") ||
      (href ? href.replace("#", "").trim() : "");
    if (pageName) {
      link.addEventListener("click", () => {
        // Offcanvas-Support
        const offcanvasNavbar = document.getElementById("offcanvasNavbar");
        if (offcanvasNavbar && typeof bootstrap !== "undefined") {
          const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasNavbar);
          if (offcanvas && offcanvasNavbar.classList.contains("show")) {
            offcanvas.hide();
          }
        }
        // Collapse-Support (navbarNav)
        const collapseNavbar = document.getElementById("navbarNav");
        if (collapseNavbar && typeof bootstrap !== "undefined") {
          const collapse = bootstrap.Collapse.getInstance(collapseNavbar) || new bootstrap.Collapse(collapseNavbar, { toggle: false });
          if (collapseNavbar.classList.contains("show")) {
            collapse.hide();
          }
        }
      });
    }
  });
}

function getPageFromHash() {
  const hash = window.location.hash.replace("#", "").trim();
  const validPages = ["startseite", "beschreibung", "kontakt", "datenschutz", "impressum"];
  if (validPages.includes(hash)) {
    return hash;
  }
  return "startseite";
}

function updateActiveNavLink(page) {
  document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    const pageName =
      link.getAttribute("data-page") ||
      (href ? href.replace("#", "").trim() : "");
    if (pageName === page) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

function handleRouting() {
  const page = getPageFromHash();
  if (window.location.hash !== `#${page}`) {
    window.location.hash = `#${page}`;
    return;
  }
  loadPage(page);
  updateActiveNavLink(page);
}
