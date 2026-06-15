@echo off
REM ============================================================
REM  NIKOS Website - Ein-Befehl-Deployment auf GitHub
REM ------------------------------------------------------------
REM  Nutzung:
REM     deploy "Beschreibung der Aenderung"
REM
REM  Was passiert:
REM     1. Alle Aenderungen werden committed
REM     2. Eine neue Versionsnummer (v1, v2, v3, ...) wird vergeben
REM     3. Commit UND Versions-Tag werden zu GitHub gepusht
REM
REM  Alte Versionen bleiben als Tags dauerhaft erhalten:
REM     - ansehen:        git tag
REM     - wiederherstellen: git checkout vN
REM ============================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

REM --- Commit-Nachricht aus dem Argument (oder Standardtext) ---
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Website-Update"

REM --- Pruefen, ob Git-Repo schon eingerichtet ist ---
if not exist ".git" (
  echo [Setup] Dieser Ordner ist noch nicht mit GitHub verbunden.
  set /p REPOURL=Bitte Repo-URL eingeben ^(z.B. https://github.com/USER/REPO.git^):
  git init
  git branch -M main
  git remote add origin "!REPOURL!"
  echo [Setup] Verbunden mit !REPOURL!
)

REM --- Git-Identitaet pruefen (sonst schlaegt der erste Commit fehl) ---
git config user.name >nul 2>&1
if errorlevel 1 (
  echo [Fehler] Git kennt deine Identitaet noch nicht. Bitte einmalig setzen:
  echo     git config --global user.name "Dein Name"
  echo     git config --global user.email "deine@mail.de"
  goto :ende
)

echo.
echo === Aenderungen werden gespeichert ===
git add -A
git commit -m "%MSG%"

REM --- Standardbranch ermitteln (erst NACH dem ersten Commit zuverlaessig) ---
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if "%BRANCH%"=="" set "BRANCH=main"
if "%BRANCH%"=="HEAD" set "BRANCH=main"

REM --- Sicherstellen, dass mindestens ein Commit existiert ---
git rev-parse HEAD >nul 2>&1
if errorlevel 1 (
  echo [Fehler] Es gibt noch keinen Commit - Abbruch. Bitte Meldung oben pruefen.
  goto :ende
)

REM --- Naechste Versionsnummer ermitteln (hoechstes vN + 1) ---
set "NUM=0"
for /f "tokens=1 delims= " %%t in ('git tag --list "v*" 2^>nul') do (
  set "T=%%t"
  set "T=!T:v=!"
  REM nur rein numerische Tags beruecksichtigen
  echo !T!| findstr /r "^[0-9][0-9]*$" >nul && (
    if !T! GTR !NUM! set "NUM=!T!"
  )
)
set /a NEXT=NUM+1
set "VERSION=v!NEXT!"

echo.
echo === Neue Version: %VERSION% ===
git tag -a "%VERSION%" -m "%MSG%"

echo.
echo === Push zu GitHub (Branch %BRANCH% + Tag %VERSION%) ===
git push origin "%BRANCH%"
git push origin "%VERSION%"

echo.
echo ============================================================
echo  Fertig. Release %VERSION% wurde deployed.
echo  - Alle Versionen anzeigen:   git tag
echo  - Version wiederherstellen:  git checkout %VERSION%
echo  - Zurueck zur aktuellen:     git checkout %BRANCH%
echo ============================================================

:ende
endlocal
