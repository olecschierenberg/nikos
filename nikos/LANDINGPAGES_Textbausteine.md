# NIKOS Landingpage — Freigegebene Textbausteine
_Stand: 18.06.2026 — NUR diese Bausteine als inhaltliche Grundlage verwenden._
_Erfinde KEINE darüber hinausgehenden Funktionen oder Szenarien._

---

## Zweck
Dieser Pool enthält vom Nutzer freigegebene, inhaltlich korrekte Textbausteine.
Die KI nutzt sie als Wissensdatenbank und Stilreferenz — nicht als 1:1-Vorlage.
Ziel: konkrete, gut funktionierende Formulierungen in unterschiedlichen Kombinationen verwenden,
ohne dass der Prompt immer größer wird.

---

## Freigegebene Bausteine

### Subhead (Nutzen-Überschrift)
- „Krisensichere Durchsage- und Alarmierungsinfrastruktur bei Strom‑ und Netzausfall"

### Intro (3–4 Sätze, erklärt NIKOS + Fallbezug)
- „NIKOS ist ein modulares, autarkes Kommunikations- und Sicherheitssystem zur zielgerichteten Ausspielung von Durchsageeinheiten in frei definierbaren Bereichen. Für [EINSATZ] in [REGION] stellt NIKOS die unterbrechungsfreie Informationsübermittlung sicher, auch bei Strom- oder Internetausfall. Komponenten wie NIKOS [audio]² sind extrem robust, wetterfest und besitzen eine interne Notstromversorgung."

### USP (technisch + Kosteneinsparung)
- „Durch die Kombination von Alarm-, Ansage- und Steuerfunktionen in einer Plattform sinkt der Bedarf an separaten Lautsprecheranlagen, dedizierten Steuergeräten und Fachkräften für mehrere Teilsysteme. Zentrale Steuerung über NIKOS [dispatcher]² und Zusatzfunktionen wie optische Signalisierung über NIKOS [flash]² oder Schaltung von externen Geräten über NIKOS [relay]² ermöglichen eine Erhöhung des Sicherheitsstandards und der Funktionalitäten bei gleichzeitiger Reduzierung der Gesamtkosten."

### Referenztexte (vollständiger Fall: Notfalldurchsage · Stadtfest · Sachsen-Anhalt)
→ Siehe `nikos/LANDINGPAGES_Referenztexte.md` (wortgenau freigegebener Goldstandard)

---

## Verbotene Formulierungen / Regeln

- ❌ „NIKOS ersetzt KEINE Funkgeräte, sondern NUTZT Funk zur Ansprache der Durchsageeinheiten." — ergibt keinen praktischen Sinn, NIE verwenden
- ❌ Logging, Protokollierung, Dokumentationsfunktion, Verlaufsaufzeichnung behaupten — NIKOS hat das NICHT
- ❌ Weichmacher: „möglich", „könnte", „kann ggf." — NIKOS funktioniert definitiv
- ❌ Inhalte aus intro/subhead in FAQ wiederholen — FAQ bringt NEUEN Mehrwert
- ❌ Funktionen erfinden, die nicht aus der nikos.audio-Website hervorgehen
- ❌ n8n-Variablen wie {{ $json.Einsatz }} als Text ausgeben — immer das echte Wort einsetzen

---

## Modulschreibweise (IMMER exakt)
`NIKOS [audio]²`, `NIKOS [dispatcher]²`, `NIKOS [horn]²`, `NIKOS [flash]²`,
`NIKOS [relay]²`, `NIKOS [clamp]²`, `NIKOS [LED]²`, `NIKOS [XLR]²`, `NIKOS [moon]²`
→ Hochgestelltes ² (Unicode ²), Modulname klein in eckigen Klammern, NIE `[audio]2`

---

## FAQ-Prioritäten
1. Normkonformität / Genehmigung (DIN EN 50849) — sachlich, keine Logging-Behauptung
2. Kosteneinsparung (Personal / Material / Synergien)
3. Unabhängigkeit / Resilienz (eigenes Funknetz, NIKOS [audio]² Akku bis 16 h)
4. Installation / Flexibilität / Funktionsbreite

---

## Änderungshistorie
| Datum | Änderung |
|-------|----------|
| 18.06.2026 | Pool angelegt; Bausteine aus Nutzer-Feedback übernommen |
| 18.06.2026 | Funk-Satz verboten; FAQ-Redundanz-Regel; Variablen-Regel ergänzt |
