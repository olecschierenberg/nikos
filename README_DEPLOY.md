# NIKOS Website – Deployment auf GitHub (mit Versionen)

Dieses Verzeichnis (`nikos/site/`) ist die Arbeitskopie der Website.
Mit **einem Befehl** wird eine neue, dauerhaft wiederherstellbare Version auf GitHub veröffentlicht.

---

## Täglicher Gebrauch – ein Befehl

In der Eingabeaufforderung oder PowerShell in diesem Ordner:

```
deploy "Kurze Beschreibung der Änderung"
```

Beispiel:

```
deploy "CTA-Abstände korrigiert, Footer aktualisiert"
```

Das Skript erledigt automatisch:

1. Alle Änderungen werden gespeichert (Commit).
2. Eine neue Versionsnummer wird vergeben: `v1`, `v2`, `v3`, …
3. Commit **und** Versions-Tag werden zu GitHub gepusht.
4. GitHub Pages aktualisiert die Live-Seite automatisch (meist 1–2 Minuten).

---

## Einmalige Einrichtung

### 1. Erster Aufruf verbindet den Ordner mit GitHub
Beim allerersten `deploy`-Aufruf fragt das Skript einmalig nach der Repo-URL, z. B.:

```
https://github.com/DEIN-USER/DEIN-REPO.git
```

Danach ist alles verbunden; die URL wird nicht wieder abgefragt.

> Hinweis: Wenn du das Repo lieber zuerst klassisch klonst, kannst du auch
> deinen vorhandenen Klon nutzen und die Dateien hier hineinlegen – dann
> überspringt das Skript die Einrichtung automatisch.

### 2. GitHub Pages aktivieren (nur einmal, im Browser)
1. Auf GitHub: **Repo → Settings → Pages**
2. Unter **Source**: „Deploy from a branch"
3. **Branch:** `main`, **Folder:** `/ (root)` → **Save**
4. Nach kurzer Zeit erscheint dort die Live-URL
   (z. B. `https://DEIN-USER.github.io/DEIN-REPO/`).

Ab dann geht jeder `deploy`-Aufruf automatisch live.

---

## Alte Versionen ansehen & wiederherstellen

Jede Version ist ein dauerhafter Git-Tag und bleibt erhalten.

```bash
git tag                 # alle Versionen auflisten (v1, v2, ...)
git show v3             # Was wurde in v3 geändert / Commit-Info
git checkout v2         # Stand von Version 2 lokal ansehen
git checkout main       # zurück zur aktuellen Arbeitsversion
```

Auf GitHub findest du dieselben Versionen unter **Code → Tags** bzw. **Releases**.
Dort lässt sich jede Version auch als ZIP herunterladen.

### Eine alte Version wieder live schalten
Wenn eine frühere Version wieder die aktuelle sein soll:

```bash
git checkout main
git revert --no-edit HEAD          # macht die letzte Änderung rückgängig
deploy "Rollback auf vorherigen Stand"
```

oder gezielt den Stand eines Tags übernehmen:

```bash
git checkout main
git checkout v2 -- .               # Dateien von v2 in den aktuellen Stand holen
deploy "Stand von v2 wiederhergestellt"
```

---

## Wichtig zu verstehen

- **Live ist immer der `main`-Branch** (das zeigt GitHub Pages an).
- **Die Tags `v1, v2, …` sind das Versionsarchiv** – sie überschreiben die Live-Seite nicht,
  sondern markieren feste Stände zum Nachschauen und Wiederherstellen.
- So entwickelst du in `nikos/site/` weiter und hast nach jedem `deploy`
  eine saubere, benannte Version, ohne je etwas zu verlieren.
