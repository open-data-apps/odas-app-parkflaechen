/*
 * Diese Funktion ist für die Inhalte der Startseite
 * zuständig.
 *
 * @param {Object} configdata - Alle Konfigurationsdaten der App
 * @returns {string} - darzustellendes HTML
 */
let map;
let markerClusterGroup;

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWeitereInfos(configdata) {
  const links = String(configdata.weiterfuehrendeLinks || "").trim();
  if (!links) return "";
  return (
    '<section class="pf-weitere-infos mt-4">' +
    '<h2 class="h5 mb-3">Weitere Informationen</h2>' +
    '<div class="pf-weitere-infos-content">' +
    links +
    "</div></section>"
  );
}

function renderMethodikbox(configdata) {
  const hinweis = String(configdata.datenquelleHinweis || "").trim();
  const stand = String(configdata.datenStand || "").trim();
  if (!hinweis && !stand) return "";
  const standHtml = stand
    ? '<p class="text-muted small mb-2">' + escapeHtml(stand) + "</p>"
    : "";
  return (
    '<section class="pf-methodik mt-3">' +
    '<button class="pf-methodik-toggle collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#pf-methodik-body" ' +
    'aria-expanded="false" aria-controls="pf-methodik-body">' +
    '<h2 class="h5 mb-0">Methodik &amp; Datenquelle</h2>' +
    '<span class="pf-methodik-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="pf-methodik-body" class="collapse">' +
    '<div class="pf-methodik-content">' +
    standHtml +
    hinweis +
    "</div></div></section>"
  );
}

function app(configdata, enclosingHtmlDivElement) {
  const poiSidebar = document.getElementById("poiSidebar");
  enclosingHtmlDivElement.innerHTML = `
    <header class="header">
      <h1>${escapeHtml(configdata.titel || "Points of Interest")}</h1>
      <div id="pf-datenstand-wrap"></div>
    </header>
    <div id="map"></div>
    <div id="pf-methodik-wrap"></div>
    <div id="pf-weitere-infos-wrap"></div>
  `;
  const methodikHtml = renderMethodikbox(configdata);
  if (methodikHtml) {
    const mel = enclosingHtmlDivElement.querySelector("#pf-methodik-wrap");
    if (mel) mel.innerHTML = methodikHtml;
  }
  const weitereHtml = renderWeitereInfos(configdata);
  if (weitereHtml) {
    const wel = enclosingHtmlDivElement.querySelector("#pf-weitere-infos-wrap");
    if (wel) wel.innerHTML = weitereHtml;
  }
  initializeMap();
  poiSidebar.style.display = "block";
}

function startAutoRefresh() {
  setInterval(async () => {
    console.log("Daten werden aktualisiert...");
    await updateMap(false); // Aktualisiere die Karte im Hintergrund ohne Bounds-Reset
  }, 30000); // Aktualisierung alle 30 Sekunden
}

/**
 * Extrahiert den Pfad aus einer vollständigen URL.
 * @param {string} url
 * @returns {string}
 */
function extractPathFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch (e) {
    return url;
  }
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
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${poi.latitude},${poi.longitude}`;
      const popupContent = `
        <strong>${poi.name}</strong><br>
        ${poi.description}<br>
        <strong>Maximale Parkplätze: ${poi.maxSpaces}</strong><br>
        <strong>Freie Parkplätze: ${freeSpaces}</strong><br>
        <a href="${googleMapsUrl}" target="_blank">In Google Maps ansehen</a>
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
  const datastoreApiUrl = new URL(configData.apiurl).origin + "/api/3/action/datastore_search";
  const query = `?resource_id=${resourceId}`;
  const fullPath = window.location.pathname.replace(/\/+$/, "");
  const proxyEndpoint = `${fullPath}/odp-data?path=${extractPathFromUrl(datastoreApiUrl + query)}`;

  const response = await fetch(proxyEndpoint, { method: "POST" });
  if (!response.ok) {
    throw new Error(`HTTP-Fehler ${response.status}`);
  }

  const proxyData = await response.json();
  const data = JSON.parse(proxyData.content);

  if (!data || !data.result || !data.result.records) {
    throw new Error("Ungültige Antwortstruktur");
  }

  return data.result.records;
}

async function updateMap(fitBounds = false) {
  try {
    if (!map) {
      console.log("Karte nicht aktiv. Aktualisierung übersprungen.");
      return;
    }

    // Dataset-Wert aus der API-URL extrahieren
    const dataset = new URL(configData.apiurl).searchParams.get("id");
    if (!dataset) {
      throw new Error("Keine Dataset-ID in der apiurl gefunden.");
    }

    // Ressourcen-IDs und Namen abrufen (über Proxy)
    const { resources, metadataModified } = await getAllResourceNamesAndIdsFromDataset(dataset);
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
  }
}

async function initializeMap() {
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
  await updateMap(true);
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
    const apiUrl = `${new URL(configData.apiurl).origin}/api/3/action/package_show?id=${datasetId}`;
    const fullPath = window.location.pathname.replace(/\/+$/, "");
    const proxyEndpoint = `${fullPath}/odp-data?path=${extractPathFromUrl(apiUrl)}`;

    const response = await fetch(proxyEndpoint, { method: "POST" });
    if (!response.ok) {
      throw new Error("Fehler beim Abrufen der Ressourcen-Informationen");
    }

    const proxyData = await response.json();
    let data;
    try {
      data = JSON.parse(proxyData.content);
    } catch (e) {
      console.error("Fehler beim Parsen der Ressourcen-Informationen:", e);
      return { resources: [], metadataModified: null };
    }

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
    console.error("Fehler beim Abrufen der Ressource-Informationen:", error);
    return { resources: [], metadataModified: null };
  }
}

/*
 * Diese Funktion kann Bibliotheken und benötigte Skripte laden.
 * Sie hängt den zurückgegebenen HTML Code in die Head Section an.
 *
 * @returns {string} - HTML mit script, link, etc. Tags
 */
function addToHead() {}
