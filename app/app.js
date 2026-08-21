/*
 * Diese Funktion ist für die Inhalte der Startseite
 * zuständig.
 *
 * @param {Object} configdata - Alle Konfigurationsdaten der App
 * @returns {string} - darzustellendes HTML
 */
let map;
let markerClusterGroup;

/*
 * Generation-Zaehler gegen veraltete Async-Fortsetzungen (F-70). map/markerClusterGroup
 * sind modulweite Singletons (keine Instanz pro Container); initializeMap() erhoeht den
 * Zaehler synchron bei jedem (Re-)Aufbau der Karte und reicht den aktuellen Wert an
 * updateMap() durch. Kehrt updateMap() nach einem await zurueck und der modulweite Zaehler
 * hat sich inzwischen veraendert (neue Instanz oder Seite verlassen), wird die Fortsetzung
 * abgebrochen, bevor sie DOM/Karte-Zustand einer bereits ueberholten Instanz beschreibt.
 */
let mapGeneration = 0;

/*
 * Template-Hook (oda-generic 1.4.0). Die Base ruft ihn vor dem Rendern der neuen Seite
 * auf. Diese App haelt eine Leaflet-Karte samt Cluster-Layer und eine eigene Sidebar
 * ausserhalb von #main-content; beides muss beim Verlassen der Startseite abgeraeumt bzw.
 * ausgeblendet werden. Frueher stand diese Logik in app/app-base.js und hat die Datei vom
 * Template abweichen lassen.
 */
function onPageLeave(page) {
  if (page !== "startseite") {
    // Markiert alle noch laufenden updateMap()-Fortsetzungen als veraltet, auch wenn
    // deren Fetch noch vor dem eigentlichen map.remove() unten in Flight ist.
    mapGeneration++;
  }
  if (page !== "startseite" && map) {
    try {
      map.remove();
    } catch (e) {
      console.warn("Fehler beim Entfernen der Leaflet-Karte:", e);
    }
    map = null;
    markerClusterGroup = null;
  }

  const poiSidebar = document.getElementById("poiSidebar");
  const sidebartoggle = document.getElementById("sidebartoggle");
  if (page === "startseite") {
    if (sidebartoggle) sidebartoggle.style.visibility = "";
  } else {
    if (sidebartoggle) sidebartoggle.style.visibility = "hidden";
    if (poiSidebar) poiSidebar.style.display = "none";
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

function app(configdata, enclosingHtmlDivElement) {
  const quelle = getOdasApiUrl(configdata, "parkflaechen");
  if (!quelle || /^\{\{.*\}\}$/.test(quelle) || /^<.*>$/.test(quelle)) {
    enclosingHtmlDivElement.innerHTML =
      '<div class="alert alert-info m-4" role="alert">Es ist keine Datenquelle konfiguriert.</div>';
    return;
  }

  const poiSidebar = document.getElementById("poiSidebar");
  enclosingHtmlDivElement.innerHTML = `
    <header class="header">
      <h1>${escapeHtml(configdata.titel || "Points of Interest")}</h1>
      <div id="pf-datenstand-wrap"></div>
    </header>
    <div id="map"></div>
  `;
  initializeMap();
  poiSidebar.style.display = "block";
}

/**
 * Extrahiert den Pfad aus einer vollständigen URL.
 * @param {string} url
 * @returns {string}
 */
function isOdasProxyEnabled(configdata = {}) {
  return String(configdata.proxyAktiv || "").trim().toLowerCase() === "ja";
}

function extractPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (_error) {
    return String(url || "");
  }
}

function getOdasAppBasePath(pathname) {
  let appPath =
    pathname === undefined
      ? typeof window !== "undefined"
        ? window.location.pathname
        : "/"
      : String(pathname || "/");

  if (!appPath.endsWith("/")) {
    const lastSlashIndex = appPath.lastIndexOf("/");
    const lastSegment = appPath.substring(lastSlashIndex + 1);
    if (lastSegment.includes(".")) {
      appPath = appPath.substring(0, lastSlashIndex + 1);
    }
  }

  return appPath.replace(/\/+$/, "");
}

function getOdasProxyEndpoint(targetUrl, pathname) {
  const appPath = getOdasAppBasePath(pathname);
  return `${appPath}/odp-data?path=${encodeURIComponent(
    extractPathFromUrl(targetUrl),
  )}`;
}

async function fetchViaOdasProxy(targetUrl) {
  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}`);
  }

  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("ODAS-Proxy-Antwort enthält keinen content-String.");
  }

  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    throw new Error(
      `Direkter Datenabruf fehlgeschlagen (${error.message}). Bitte prüfen Sie die Daten-URL und die CORS-Freigabe der Datenquelle.`,
    );
  }
}

/**
 * Löst eine benannte Datenressource aus configdata.apiurls auf.
 * Neue apiurls-Form (typ: "array"); das frühere skalare apiurl wird nicht mehr gelesen.
 * @returns {string} getrimmte URL, oder "" für den Zustand "keine Quelle konfiguriert"
 */
function getOdasApiUrl(configdata, name) {
  const liste = Array.isArray(configdata && configdata.apiurls) ? configdata.apiurls : [];
  const treffer = liste.find((eintrag) => eintrag && eintrag.name === name);
  return String((treffer && treffer.url) || "").trim();
}

async function fetchOdasJson(targetUrl, configdata = {}) {
  const rawContent = await fetchOdasResource(targetUrl, configdata);
  try {
    return JSON.parse(rawContent);
  } catch (_error) {
    throw new Error(
      `Die konfigurierte Daten-URL liefert kein JSON, sondern ${describeNonJsonPayload(rawContent)}. ` +
        "Bitte in der Instanzkonfiguration den API-Endpunkt der Datenquelle eintragen, " +
        "nicht den Datensatz- oder Download-Link.",
    );
  }
}

function describeNonJsonPayload(rawContent) {
  const text = String(rawContent == null ? "" : rawContent).trim();
  if (!text) return "eine leere Antwort";
  if (text.startsWith("<")) return "eine HTML-Seite";
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (/[,;]/.test(firstLine)) return "eine CSV- oder Textdatei";
  return "unlesbaren Inhalt";
}

/**
 * Erstellt Marker und Listeneinträge für POIs und fügt sie dem Cluster und der Liste hinzu.
 */
function renderPOIsOnMapAndSidebar(poiGroups, targetClusterGroup, poiList) {
  poiList.innerHTML = "";
  Object.keys(poiGroups).forEach((resourceName) => {
    const resourceHeader = document.createElement("h5");
    resourceHeader.textContent = `${resourceName}`;
    poiList.appendChild(resourceHeader);

    poiGroups[resourceName].forEach((poi) => {
      const freeSpaces = parseInt(poi.freeSpaces, 10) || 0;
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(poi.latitude))},${encodeURIComponent(String(poi.longitude))}`;
      const popupContent = `
        <strong>${escapeHtml(poi.name)}</strong><br>
        ${escapeHtml(poi.description)}<br>
        <strong>Maximale Parkplätze: ${escapeHtml(poi.maxSpaces)}</strong><br>
        <strong>Freie Parkplätze: ${escapeHtml(freeSpaces)}</strong><br>
        <a href="${escapeHtml(googleMapsUrl)}" target="_blank">In Google Maps ansehen</a>
      `;

      const marker = L.marker([poi.latitude, poi.longitude], {
        freeSpaces: freeSpaces,
      })
        .bindPopup(popupContent)
        .bindTooltip(`${freeSpaces} freie Plätze`, { permanent: true });

      targetClusterGroup.addLayer(marker);

      const poiItem = document.createElement("li");
      poiItem.classList.add("list-group-item");
      poiItem.textContent = `${poi.name} (${freeSpaces} frei)`;
      poiItem.addEventListener("click", () => {
        targetClusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      });
      poiList.appendChild(poiItem);
    });
  });
}

/**
 * Holt die Daten für eine einzelne Ressource vom Proxy-Server.
 */
async function fetchResourceRecords(resourceId) {
  const datastoreApiUrl = new URL(getOdasApiUrl(configData, "parkflaechen")).origin + "/api/3/action/datastore_search";
  const query = `?resource_id=${resourceId}`;
  // Daten laden: direkt oder ueber den ODAS-Proxy (proxyAktiv)
  const data = await fetchOdasJson(datastoreApiUrl + query, configData);

  if (!data || !data.result || !data.result.records) {
    throw new Error("Ungültige Antwortstruktur");
  }

  return data.result.records;
}

async function updateMap(fitBounds = false, generation = mapGeneration) {
  try {
    if (!map || generation !== mapGeneration) {
      console.log("Karte nicht aktiv oder veraltet. Aktualisierung übersprungen.");
      return;
    }

    // Dataset-Wert aus der API-URL extrahieren
    const dataset = new URL(getOdasApiUrl(configData, "parkflaechen")).searchParams.get("id");
    if (!dataset) {
      throw new Error("Keine Dataset-ID in der apiurls.parkflaechen gefunden.");
    }

    // Ressourcen-IDs und Namen abrufen (über Proxy)
    const { resources, metadataModified } = await getAllResourceNamesAndIdsFromDataset(dataset);
    // Waehrend des Fetch kann eine neuere Instanz gestartet worden oder die Seite
    // verlassen worden sein (F-70): dann nichts mehr in DOM/Karte schreiben.
    if (generation !== mapGeneration) return;
    if (resources.length === 0) {
      throw new Error("Keine Ressourcen im Dataset gefunden");
    }

    // Datenfrische anzeigen
    if (metadataModified) {
      const d = new Date(metadataModified);
      if (!isNaN(d.getTime())) {
        const dsWrap = document.getElementById("pf-datenstand-wrap");
        if (dsWrap) dsWrap.innerHTML = '<div class="text-muted small">Aktualisiert: ' + escapeHtml(d.toLocaleDateString("de-DE")) + '</div>';
      }
    }

    const poiNames = new Set();
    const poiGroups = {};

    // Erstelle temporär ein neues Cluster, um Flackern zu minimieren
    const newClusterGroup = L.markerClusterGroup({
      iconCreateFunction: function (cluster) {
        const totalFreeSpaces = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + (marker.options.freeSpaces || 0), 0);
        return L.divIcon({
          html: `<div class="custom-cluster-icon">${totalFreeSpaces}</div>`,
          className: "marker-cluster",
          iconSize: [40, 40],
        });
      },
    });

    for (const resource of resources) {
      const { id: resourceId, name: resourceName } = resource;
      try {
        const records = await fetchResourceRecords(resourceId);
        // Erneuter Check nach dem await: eine zwischenzeitlich gestartete neuere
        // Instanz gewinnt, diese Fortsetzung bricht ab (F-70).
        if (generation !== mapGeneration) return;
        if (records.length === 0) {
          console.warn(`Keine POIs gefunden für Ressource ID: ${resourceId}`);
          continue;
        }

        if (!poiGroups[resourceName]) {
          poiGroups[resourceName] = [];
        }

        records.forEach((poi) => {
          if (poiNames.has(poi.name)) {
            return;
          }
          poiNames.add(poi.name);
          poiGroups[resourceName].push(poi);
        });
      } catch (e) {
        console.warn(`Fehler beim Laden der Ressource "${resourceName}" (${resourceId}):`, e);
      }
    }

    // Render in Sidebar und auf die temporäre Cluster-Gruppe
    renderPOIsOnMapAndSidebar(
      poiGroups,
      newClusterGroup,
      document.getElementById("poiList")
    );

    // Entferne die alte Cluster-Gruppe falls vorhanden
    if (markerClusterGroup) {
      try {
        map.removeLayer(markerClusterGroup);
      } catch (e) {
        console.warn("Fehler beim Entfernen der alten Cluster-Gruppe:", e);
      }
    }

    // Setze die neue Cluster-Gruppe auf die Karte
    markerClusterGroup = newClusterGroup;
    map.addLayer(markerClusterGroup);

    if (fitBounds && markerClusterGroup.getLayers().length > 0) {
      map.fitBounds(markerClusterGroup.getBounds(), { maxZoom: 5 });
    }
  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
    // Fehler nur anzeigen, wenn diese Fortsetzung noch zur aktuellen Instanz gehoert;
    // sonst wuerde eine veraltete Fehlermeldung den Erfolgszustand einer neueren,
    // inzwischen erfolgreich geladenen Instanz ueberschreiben (F-70/F-75).
    if (generation === mapGeneration) {
      const poiList = document.getElementById("poiList");
      if (poiList) {
        poiList.innerHTML = `<li class="list-group-item"><div class="alert alert-danger mb-0" role="alert"><strong>Fehler beim Laden der Daten:</strong> ${escapeHtml(
          error.message,
        )}</div></li>`;
      }
    }
  }
}

async function initializeMap() {
  // Neue Generation fuer diesen (Re-)Aufbau der Karte (F-70); wird synchron vor jeder
  // Async-Arbeit erhoeht, damit noch laufende Fortsetzungen der vorherigen Instanz sich
  // beim naechsten Check als veraltet erkennen.
  const myGeneration = ++mapGeneration;

  if (typeof map !== 'undefined' && map) {
    try {
      map.remove();
    } catch (e) {
      console.warn("Fehler beim Entfernen der Leaflet-Karte in initializeMap:", e);
    }
    map = null;
  }

  map = L.map("map").setView([51.1657, 10.4515], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  setupEventListeners();

  // Initiales Laden der Karte mit Bounds-Zentrierung
  await updateMap(true, myGeneration);
}

function setupEventListeners() {
  // Event-Listener überschreiben, um doppelte Listener bei Navigation zu verhindern
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.onkeyup = function () {
      let filter = this.value.toLowerCase();
      let items = document.querySelectorAll("#poiList .list-group-item");
      items.forEach((item) => {
        let text = item.textContent.toLowerCase();
        item.style.display = text.includes(filter) ? "" : "none";
      });
    };
  }

  const sidebartoggle = document.getElementById("sidebartoggle");
  if (sidebartoggle) {
    sidebartoggle.onclick = function () {
      const poiSidebar = document.getElementById("poiSidebar");
      if (poiSidebar) {
        poiSidebar.classList.toggle("show");
      }
    };
  }
}

async function getAllResourceNamesAndIdsFromDataset(datasetId) {
  try {
    const apiUrl = `${new URL(getOdasApiUrl(configData, "parkflaechen")).origin}/api/3/action/package_show?id=${datasetId}`;
    // Daten laden: direkt oder ueber den ODAS-Proxy (proxyAktiv)
    const data = await fetchOdasJson(apiUrl, configData);

    if (
      !data ||
      !data.result ||
      !data.result.resources ||
      data.result.resources.length === 0
    ) {
      throw new Error("Keine Ressourcen gefunden für das angegebene Dataset");
    }

    return { resources: data.result.resources.map((resource) => ({
      id: resource.id,
      name: resource.name || "Unbekannte Ressource",
    })), metadataModified: data.result.metadata_modified || null };
  } catch (error) {
    // Fehler NICHT verschlucken (F-75): ein kaputter/nicht erreichbarer API-Endpunkt
    // muss updateMap()s Fehlerbehandlung erreichen, statt hier still als "0 Ressourcen
    // gefunden" behandelt zu werden.
    console.error("Fehler beim Abrufen der Ressource-Informationen:", error);
    throw error;
  }
}

/*
 * Diese Funktion kann Bibliotheken und benötigte Skripte laden.
 * Sie hängt den zurückgegebenen HTML Code in die Head Section an.
 *
 * @returns {string} - HTML mit script, link, etc. Tags
 */
function addToHead() {}
