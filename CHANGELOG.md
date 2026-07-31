# Changelog

## 1.6.0 - 2026-07-31
- CHG: toter Konfigurationsschlüssel lizenz entfernt (F-17)
- CHG: brandingCSS und brandingCSSFile als Base-Abhängigkeiten deklariert und lokal gespiegelt (F-17)
- CHG: dropdown-Default auf Feldebene verschoben statt in format (F-18)
- CHG: Platzhalter-Entwickler mueller-gmbh durch ondics-gmbh ersetzt (F-21)
- CHG: Platzhalter Mueller GmbH aus der Fußzeile entfernt (F-21)
- CHG: daten.schema auf assets/schema.json gesetzt (F-20)

## 1.5.0 - 2026-07-30

- **FIX:** Der Marker `_multiline_` erscheint nicht mehr im Text von Beschreibung, Kontakt, Datenschutz und Impressum. Mehrzeilige Konfigurationswerte werden jetzt mit erhaltenen Zeilenumbruechen dargestellt
- **FIX:** Laufzeitfehler nach dem Laden der Konfiguration werden jetzt sichtbar gemeldet; `handleRouting()` wird `await`et und besitzt einen Fehlerpfad
- **FIX:** `getConfigUrl()` schneidet bei einer URL ohne abschliessenden Schraegstrich nicht mehr das letzte Verzeichnis ab
- **FIX:** Klick auf einen Hash-Link, der bereits die aktive Seite bezeichnet, rendert die Seite neu (`setupSamePageLinks()`)
- **ENH:** `app/app-base.js` ist wieder byte-identisch zum Template `oda-generic` 1.4.0. Das Abraeumen der Leaflet-Karte und das Ausblenden der Sidebar sind als `onPageLeave(page)` nach `app/app.js` gewandert
- **ENH:** Die nie aufgerufene Funktion `startAutoRefresh()` entfernt (toter Code)

## 1.4.0 - 2026-07-24

- **FIX:** Laufzeit-Fehlermeldung wird vor der Anzeige HTML-maskiert (`escapeHtmlForBase`); ein Fehlertext kann kein Markup mehr in die Seite einschleusen (XSS)
- **FIX:** Startseiten-Renderer wird nun `await`et; bei asynchronen Apps erscheint kein kurzzeitiges `[object Promise]` in `#main-content`

## 1.3.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Direkter Datenabruf ohne Proxy-Umweg; Fehler werden nicht mehr verschluckt
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## 09.07.2026

- FIX: Karten-, Sidebar- und Responsive-Styles nach dem Schale-4-Update wiederhergestellt.
- FIX: Unpassende Startseiten-Boxen für Methodik/Datenquelle und weitere Informationen entfernt.

## 09.12.2024

- ENH: Konzentrations Icons mit Anzeige freier Parkplätze
- ENH: Sidebar Gruppierungen nach Datensatz

## 13.12.2024

- ENH: Daten werden aus dem Datastore bezogen
- ENH: Makefile zip Command hinzugefügt
