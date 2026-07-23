# Changelog

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
