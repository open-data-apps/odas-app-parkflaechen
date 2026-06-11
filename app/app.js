/*
 * Diese Funktion ist für die Inhalte der Startseite
 * zuständig.
 *
 * @param {Object} configdata - Alle Konfigurationsdaten der App
 * @returns {string} - darzustellendes HTML
 */
let map;
function app(configdata, enclosingHtmlDivElement) {
  const poiSidebar = document.getElementById("poiSidebar");
  enclosingHtmlDivElement.innerHTML = `<header class="header">
        <h1>Points of Interest</h1>
      <div id="map"></div>`;
  initializeMap();
  poiSidebar.style.display = "block"; // Zeige die Sidebar an
  const mediaQuery = window.matchMedia("(max-width: 768px)");
  function handleMediaQueryChange(e) {
    if (e.matches) {
      const sidebartoggle = document.getElementById("sidebartoggle");
      sidebartoggle.style.visibility = "visible";
    }
  }
  handleMediaQueryChange(mediaQuery);
  mediaQuery.addListener(handleMediaQueryChange);
}
function startAutoRefresh() {
  setInterval(async () => {
    console.log("Daten werden aktualisiert...");
    await updateMap(); // Aktualisiere die Karte
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
function renderPOIsOnMapAndSidebar(poiGroups, markerClusterGroup, poiList) {
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

      markerClusterGroup.addLayer(marker);

      const poiItem = document.createElement("li");
      poiItem.classList.add("list-group-item");
      poiItem.textContent = `${poi.name} (${freeSpaces} frei)`;
      poiItem.addEventListener("click", () => {
        markerClusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      });
      poiList.appendChild(poiItem);
    });
  });
}

async function updateMap() {
  const poiNames = new Set();
  const markerClusterGroup = L.markerClusterGroup({
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

  try {
    // Speichere die aktuelle Ansicht
    const currentView = {
      center: map.getCenter(),
      zoom: map.getZoom(),
    };

    // Dataset-Wert aus der API-URL extrahieren
    const dataset = new URL(configData.apiurl).searchParams.get("id");

    // Ressourcen-IDs und Namen abrufen (über Proxy)
    const resources = await getAllResourceNamesAndIdsFromDataset(dataset);

    if (resources.length === 0) {
      throw new Error("Keine Ressourcen gefunden");
    }

    const poiGroups = {};

    for (const resource of resources) {
      const { id: resourceId, name: resourceName } = resource;

      // CKAN Datastore API URL
      const datastoreApiUrl =
        new URL(configData.apiurl).origin + "/api/3/action/datastore_search";
      const query = `?resource_id=${resourceId}`;
      // Proxy-Endpunkt bauen
      const fullPath = window.location.pathname.replace(/\/+$/, "");
      const proxyEndpoint = `${fullPath}/odp-data?path=${extractPathFromUrl(
        datastoreApiUrl + query
      )}`;

      const response = await fetch(proxyEndpoint, { method: "POST" });
      const proxyData = await response.json();
      let data;
      try {
        data = JSON.parse(proxyData.content);
      } catch (e) {
        console.warn(
          `Fehler beim Parsen der Daten für Ressource ${resourceId}`
        );
        continue;
      }

      if (
        !data ||
        !data.result ||
        !data.result.records ||
        data.result.records.length === 0
      ) {
        console.warn(`Keine POIs gefunden für die Ressource ID: ${resourceId}`);
        continue;
      }

      if (!poiGroups[resourceName]) {
        poiGroups[resourceName] = [];
      }

      data.result.records.forEach((poi) => {
        if (poiNames.has(poi.name)) {
          return;
        }
        poiNames.add(poi.name);
        poiGroups[resourceName].push(poi);
      });
    }

    renderPOIsOnMapAndSidebar(
      poiGroups,
      markerClusterGroup,
      document.getElementById("poiList")
    );
    map.addLayer(markerClusterGroup);
  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
  }
}

async function initializeMap() {
  map = L.map("map").setView([51.1657, 10.4515], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  const poiNames = new Set();
  const markerClusterGroup = L.markerClusterGroup({
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

  try {
    // Dataset-Wert aus der API-URL extrahieren
    const dataset = new URL(configData.apiurl).searchParams.get("id");

    // Ressourcen-IDs und Namen abrufen (über Proxy)
    const resources = await getAllResourceNamesAndIdsFromDataset(dataset);

    if (resources.length === 0) {
      throw new Error("Keine Ressourcen gefunden");
    }

    const poiGroups = {};

    for (const resource of resources) {
      const { id: resourceId, name: resourceName } = resource;

      // CKAN Datastore API URL
      const datastoreApiUrl =
        new URL(configData.apiurl).origin + "/api/3/action/datastore_search";
      const query = `?resource_id=${resourceId}`;
      // Proxy-Endpunkt bauen
      const fullPath = window.location.pathname.replace(/\/+$/, "");
      const proxyEndpoint = `${fullPath}/odp-data?path=${extractPathFromUrl(
        datastoreApiUrl + query
      )}`;

      const response = await fetch(proxyEndpoint, { method: "POST" });
      const proxyData = await response.json();
      let data;
      try {
        data = JSON.parse(proxyData.content);
      } catch (e) {
        console.warn(
          `Fehler beim Parsen der Daten für Ressource ${resourceId}`
        );
        continue;
      }

      if (
        !data ||
        !data.result ||
        !data.result.records ||
        data.result.records.length === 0
      ) {
        console.warn(`Keine POIs gefunden für die Ressource ID: ${resourceId}`);
        continue;
      }

      if (!poiGroups[resourceName]) {
        poiGroups[resourceName] = [];
      }

      data.result.records.forEach((poi) => {
        if (poiNames.has(poi.name)) {
          return;
        }
        poiNames.add(poi.name);
        poiGroups[resourceName].push(poi);
      });
    }

    renderPOIsOnMapAndSidebar(
      poiGroups,
      markerClusterGroup,
      document.getElementById("poiList")
    );
    map.addLayer(markerClusterGroup);
    map.fitBounds(markerClusterGroup.getBounds(), { maxZoom: 5 });

    document.querySelectorAll(".navbar-nav .nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        const navbarToggler = document.querySelector(".navbar-toggler");
        const navbarCollapse = document.querySelector(".navbar-collapse");
        if (navbarCollapse.classList.contains("show")) {
          navbarToggler.click();
        }
      });
    });

    document
      .getElementById("searchInput")
      .addEventListener("keyup", function () {
        let filter = this.value.toLowerCase();
        let items = document.querySelectorAll("#poiList .list-group-item");
        items.forEach((item) => {
          let text = item.textContent.toLowerCase();
          item.style.display = text.includes(filter) ? "" : "none";
        });
      });

    document
      .getElementById("sidebartoggle")
      .addEventListener("click", function () {
        const poiSidebar = document.getElementById("poiSidebar");
        if (poiSidebar.style.visibility === "hidden") {
          poiSidebar.style.visibility = "visible";
        } else {
          poiSidebar.style.visibility = "hidden";
        }
      });
  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
  }
}

async function getAllResourceNamesAndIdsFromDataset(datasetId) {
  try {
    // CKAN package_show API URL
    const apiUrl = `${new URL(configData.apiurl).origin}/api/3/action/package_show?id=${datasetId}`;
    // Proxy-Endpunkt bauen
    const fullPath = window.location.pathname.replace(/\/+$/, "");
    const proxyEndpoint = `${fullPath}/odp-data?path=${extractPathFromUrl(
      apiUrl
    )}`;

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
      return [];
    }

    if (
      !data ||
      !data.result ||
      !data.result.resources ||
      data.result.resources.length === 0
    ) {
      throw new Error("Keine Ressourcen gefunden für das angegebene Dataset");
    }

    // Extrahieren von IDs und Namen der Ressourcen
    const resources = data.result.resources.map((resource) => ({
      id: resource.id,
      name: resource.name || "Unbekannte Ressource",
    }));

    return resources; // Rückgabe eines Arrays von Objekten mit ID und Name
  } catch (error) {
    console.error("Fehler beim Abrufen der Ressource-Informationen:", error);
    return [];
  }
}

function parseCSV(csvText) {
  const rows = csvText.trim().split("\n").slice(1);
  return rows.map((row) => {
    const [name, latitude, longitude, description, freeSpaces, maxSpaces] =
      row.split(",");
    return {
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      description,
      freeSpaces: parseInt(freeSpaces, 10),
      maxSpaces: parseInt(maxSpaces, 10),
    };
  });
}

function formatTextWithLineBreaks(text) {
  return text
    .replace(/\n/g, "<br>")
    .replace(
      /(\+?\d[\d\s()-]{4,}\d)/g,
      '<a href="tel:$1" class="phone-link">$1</a>'
    );
}

/*
 * Diese Funktion kann Bibliotheken und benötigte Skripte laden.
 * Sie hängt den zurückgegebenen HTML Code in die Head Section an.

 * @returns {string} - HTML mit script, link, etc. Tags
 */
function addToHead() {}
