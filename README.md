# TALCHI — Talk + Chat

TALCHI ist ein Messenger-Projekt. Konten funktionieren vollständig ohne E-Mail-Adresse und Telefonnummer.

## Funktionen
- Registrierung nur mit Anzeigename, Benutzername und Passwort
- Anmeldung ausschließlich mit Benutzername und Passwort
- E-Mail-Adresse und Telefonnummer werden weder abgefragt noch gespeichert

- Suche nach Benutzernamen/Anzeigenamen
- Private Chats und Nachrichten mit PostgreSQL-Speicherung
- Sitzungen über sichere HTTP-only-Cookies

## Lokal starten
1. Node.js 20+ und PostgreSQL installieren.
2. Datenbank `talchi` anlegen.
3. `.env.example` nach `.env` kopieren und `DATABASE_URL` sowie einen langen `SESSION_SECRET` setzen.
4. `npm install`
5. `npm start`
6. `http://localhost:3000` öffnen.

## Render
Die Datei `render.yaml` beschreibt einen Web-Service und eine PostgreSQL-Datenbank in Frankfurt. Render Blueprint vor dem Anwenden prüfen. Eine kostenlose Datenbank kann zeitlich bzw. funktional begrenzt sein; Verfügbarkeit und Preis im Render-Dashboard prüfen.

## Sicherheit
Passwörter werden mit bcrypt gehasht. SQL-Abfragen verwenden Parameter. Telefonnummern sind optional und werden nicht in öffentlichen Profil- oder Suchantworten ausgegeben. Für den produktiven Betrieb E-Mail-Verifizierung, Passwort-Reset, CSRF-Schutz, Datenschutz-/Impressumsseiten und Missbrauchsschutz ergänzen.
