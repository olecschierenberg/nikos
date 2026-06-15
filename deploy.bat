@echo off
REM ============================================================
REM  NIKOS Website - Ein-Befehl-Deployment auf GitHub
REM  Nutzung:   deploy "Beschreibung der Aenderung"
REM
REM  Ablauf: 1) Integritaets-Check (kein abgeschnittenes HTML)
REM          2) commit  3) Version vN taggen  4) push
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Website-Update"

if not exist ".git" (
  echo [Fehler] site\ ist noch kein Git-Repo. Bitte zuerst setup-git-einmalig.bat ausfuehren.
  goto :ende
)

REM verwaiste Sperrdateien entfernen
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo.
echo === Schritt 1: Integritaets-Check der Live-HTML-Seiten ===
REM Jede getrackte *.html (ohne .pre/.fixed) MUSS </html> enthalten.
set "KAPUTT="
for %%F in (index.html nikos-system.html nikos-produkte.html nikos-anwendungen.html nikos-referenzen.html nikos-vermietung.html nikos-vermietung-partner-werden.html nikos-downloads.html nikos-kontakt.html nikos-login.html nikos-agb.html nikos-mietbedingungen.html nikos-datenschutz.html nikos-impressum.html partner-karte.html) do (
  if exist "%%F" (
    findstr /c:"</html>" "%%F" >nul 2>&1
    if errorlevel 1 (
      echo   [WARNUNG] %%F endet ohne ^</html^> - moeglicherweise abgeschnitten!
      set "KAPUTT=1"
    )
  )
)
if defined KAPUTT (
  echo.
  echo [STOPP] Mindestens eine Seite wirkt abgeschnitten. Deployment abgebrochen.
  echo         Bitte die Datei pruefen/neu speichern, dann erneut deploy ausfuehren.
  goto :ende
)
echo   OK - alle geprueften Seiten enthalten ^</html^>.

git config user.name >nul 2>&1
if errorlevel 1 (
  echo [Fehler] Git-Identitaet fehlt. Einmalig setzen:
  echo     git config --global user.name "Dein Name"
  echo     git config --global user.email "deine@mail.de"
  goto :ende
)

echo.
echo === Schritt 2: Aenderungen committen ===
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo   [Info] Keine Aenderungen zu committen. Nur Push/Pull-Abgleich.
) else (
  git commit -m "%MSG%"
)

echo.
echo === Schritt 3: Mit GitHub abgleichen (Remote-Aenderungen holen) ===
git fetch origin
git rev-parse --abbrev-ref HEAD > "%TEMP%\nk_branch.txt"
set /p BRANCH=<"%TEMP%\nk_branch.txt"
if "%BRANCH%"=="" set "BRANCH=main"
git merge --ff-only origin/%BRANCH% 2>nul
if errorlevel 1 (
  echo   [Hinweis] Remote ist abweichend - versuche Rebase ^(nur eigene Commits oben drauf^)...
  git rebase origin/%BRANCH%
  if errorlevel 1 (
    echo.
    echo [STOPP] Merge-Konflikt. Bitte Claude / einen Entwickler hinzuziehen.
    echo         Abbrechen mit:  git rebase --abort
    goto :ende
  )
)

echo.
echo === Schritt 4: Naechste Versionsnummer ermitteln ===
set "NUM=0"
for /f "tokens=1 delims= " %%t in ('git tag --list "v*" 2^>nul') do (
  set "T=%%t"
  set "T=!T:v=!"
  echo !T!| findstr /r "^[0-9][0-9]*$" >nul && ( if !T! GTR !NUM! set "NUM=!T!" )
)
set /a NEXT=NUM+1
set "VERSION=v!NEXT!"
git tag -a "!VERSION!" -m "%MSG%"

echo.
echo === Schritt 5: Push zu GitHub (Branch + Tag) ===
git push origin "%BRANCH%"
git push origin "!VERSION!"

echo.
echo ============================================================
echo  Fertig. Release !VERSION! ist live.
echo  Website aktualisiert sich in 1-2 Min:
echo  https://olecschierenberg.github.io/nikos/
echo ============================================================

:ende
endlocal
pause
