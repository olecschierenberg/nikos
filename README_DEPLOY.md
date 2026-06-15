# NIKOS Website – Deployment auf GitHub (mit Versionen)

**`nikos/site/` ist DER eine Ordner.** Hier wird editiert, von hier wird gepusht.
Kein Kopieren mehr nach `nikos-repo/` (dieser Ordner ist stillgelegt → `nikos-repo_ALT/`).
Mit **einem Befehl** wird eine neue, dauerhaft wiederherstellbare Version auf GitHub veröffentlicht.

---

## Einmalig einrichten (nur 1×)

Doppelklick auf **`setup-git-einmalig.bat`**. Es verbindet `site/` mit dem
bestehenden GitHub-Repo (`github.com/olecschierenberg/nikos`) und übernimmt die
komplette Historie inkl. Versions-Tags. Danach `nikos-repo/` in `nikos-repo_ALT/`
umbenennen. Ab dann nur noch `deploy "..."` verwenden.

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

1. **Integritäts-Check** – prüft, dass keine HTML-Seite abgeschnitten ist
   (fehlt `</html>`, bricht es ab → schützt vor kaputten Uploads, dem Hauptproblem bisher).
2. Alle Änderungen werden gespeichert (Commit).
3. Abgleich mit GitHub (holt evtl. Remote-Änderungen, automatischer Fast-Forward/Rebase).
4. Eine neue Versionsnummer wird vergeben: `v4`, `v5`, …
5. Commit **und** Versions-Tag werden zu GitHub gepusht.
6. GitHub Pages aktualisiert die Live-Seite automatisch (meist 1–2 Minuten).

> Meldet `deploy` **„STOPP – abgeschnitten"**: die genannte Datei öffnen, prüfen,
> neu speichern, dann erneut `deploy`. Bei **„Merge-Konflikt"** nicht raten –
> `git rebase --abort` und Hilfe holen.

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
Dor