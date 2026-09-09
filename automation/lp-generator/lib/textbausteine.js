'use strict';
/**
 * NEU (2026-09-03, kein n8n-Vorbild): Wiederverwendbare, einmalig geprüft
 * freigegebene Übersetzungen fester Textbausteine (Nutzer-Idee vom
 * 2026-09-03: eine Formulierung, die sich als sprachlich hochwertig
 * erwiesen hat, einmalig mit einem stärkeren Modell erzeugen/prüfen und
 * danach OHNE weiteren KI-Aufruf wiederverwenden — spart Kosten UND
 * garantiert konstante, geprüft gute Formulierung, unabhängig davon,
 * welches Modell gerade produktiv für die übrigen Felder läuft).
 *
 * Dies ist ein GEWÖHNLICHES Node-Modul (require() möglich), wie lib/i18n.js
 * — NICHT eine der lib/nodes/*.js-Pseudo-n8n-Code-Node-Dateien (jene laufen
 * in einer new Function()-Sandbox ohne require(), siehe runCodeNode.js —
 * html_bauen.js haelt deshalb eine EIGENE, bewusst duplizierte Kopie der
 * usp_intro-Varianten, siehe dortiger Kommentar bei OPEN_DE/OPEN_EN).
 *
 * ERWEITERT (2026-09-09, Nutzer-Freigabe nach Entwurf
 * FAQ-Textvarianten_Entwurf_2026-09-09.md): aus den bisherigen EINZELNEN
 * Textbausteinen (ein String pro Sprache) wurden ARRAYS mit je 6 geprüften
 * Varianten. Zweck: Duplicate-Content-Risiko senken (identischer Satz auf
 * ~200+ Seiten) UND mehr lexikalische Vielfalt fuer verwandte Suchbegriffe
 * (z. B. "Crowd Management", "Systemmonitoring", "Geraetesteuerung" als
 * Synonym-Rotation zu den urspruenglichen 4 Kernbegriffen). Die Auswahl der
 * Variante je LP ist DETERMINISTISCH (pickUspIndex/pickFaqIndex unten,
 * geseedet aus Problem+Einsatz+Region) -- eine Seite bleibt bei
 * Regenerierung stabil bei derselben Variante, und dieselbe Variante wird
 * konsistent fuer ALLE Sprachversionen einer LP verwendet (die Arrays sind
 * indexgleich: Variante N ist in jeder Sprache dieselbe inhaltliche
 * Variante).
 *
 * usp_intro (Index 0 = bisherige, seit 2026-09-03 einzige Fassung, dient
 * als Anker/unveraendert): reiner Marken-/Plattformsatz, nicht
 * compliance-relevant. Ab 2026-09-09 zusaetzlich mit rotierenden
 * Synonymen fuer die 4 Kernbegriffe (Nutzer-Vorgabe 2026-09-09):
 * Alarmierung <-> Systemmonitoring, Durchsagen <-> Besucherinformation,
 * Besucherinformation <-> Crowd Management/Besucherlenkung, Steuerung <->
 * Geraetesteuerung.
 *
 * faq1_q/faq1_a (Normkonformitaet, DIN EN 50849): faq1_a ist ab 2026-09-09
 * NUR NOCH DER KERNBLOCK (die eigentliche Normaussage, weiterhin fest/
 * geprueft, 6 Varianten). Der bisherige letzte Satz ("RADACOM und Ihr
 * regionaler NIKOS-Partner beraten Sie...") ist reine Marketing-/
 * Kontakt-Formulierung ohne Normaussage und steht jetzt separat als
 * FAQ1_A_CLOSING_DE / FAQ1_A_CLOSING_TRANSLATIONS -- als Vorlage/Leitplanke
 * fuer die weiterhin freie, LP-spezifische KI-Generierung dieses einen
 * Satzes (siehe Konzept in FAQ-Textvarianten_Entwurf_2026-09-09.md,
 * Abschnitt "Variabler Schlusssatz"). WICHTIG (bewusste Scope-Entscheidung
 * 2026-09-09): der Aufruf-Code (index.js) generiert den Schlusssatz AKTUELL
 * NOCH NICHT frei -- das wuerde eine Aenderung des AI-Texte-Prompt-Schemas
 * (ai-texte.system.txt + texte_json.js/mini_check.js/uebersetzung_json.js
 * REQUIRED_KEYS) erfordern, was mehrere zusammenhaengende Dateien der
 * produktiv alle 30 Minuten laufenden Pipeline beruehrt. Bis diese
 * Erweiterung separat umgesetzt ist, wird FAQ1_A_CLOSING_DE/
 * FAQ1_A_CLOSING_TRANSLATIONS einfach fest an den gewaehlten Kernblock
 * angehaengt (funktional aequivalent zum bisherigen Verhalten, nur mit
 * rotierendem Kernblock statt einem einzigen fixen Text).
 *
 * Alle 6 Kernblock-Varianten je Feld enthalten dieselben Fakten wie die
 * urspruengliche Fassung (DIN EN 50849 erfuellt; entwickelt fuer
 * sicherheitsrelevante Durchsage-/Alarmierungsanwendungen, Alltag UND
 * Notfall; DIN EN 50849 = massgeblicher Rahmen fuer ELA-Anlagen; keine
 * Abhaengigkeit von externem Netz -> jederzeit sofort nutzbar; DIN EN 54/
 * DIN VDE 0833-4/DIN 14675 NICHT anwendbar; marktfuehrend seit 2017), nur
 * mit anderer Formulierung/Satzstellung -- freigegeben durch den Nutzer am
 * 2026-09-09 inkl. mehrerer Praezisierungen an Variante 3/4/5/6 (siehe
 * Chat-Verlauf / Memory nikos-landingpages-seo.md).
 *
 * Fehlt eine Sprache in einer der folgenden Listen (z. B. weil die
 * Baseline spaeter erweitert wird), faellt index.js automatisch auf die
 * frische Modell-Uebersetzung fuer das jeweilige Feld zurueck — kein
 * Codepfad bricht dadurch.
 */

// ── USP-Intro (6 Varianten je Sprache) ──────────────────────────────────

const USP_INTRO_DE_VARIANTS = [
  'NIKOS bündelt Durchsagen, Alarmierung, Besucherinformation und Steuerung in einer einzigen, netzunabhängigen Plattform.',
  'Mit NIKOS laufen Durchsagen, Systemmonitoring, Besucherinformation und Gerätesteuerung auf einer einzigen Plattform zusammen — vollständig unabhängig vom öffentlichen Netz.',
  'Eine Plattform für alles: NIKOS vereint Besucherinformation, Alarmierung, Crowd Management und Steuerung netzunabhängig in einem System.',
  'NIKOS führt Durchsagen, Alarmierung, Besucherlenkung und Gerätesteuerung in einer netzunabhängigen Plattform zusammen.',
  'Statt mehrerer Einzellösungen: NIKOS vereint Besucherinformation, Systemmonitoring, Besucherlenkung und Steuerung in einer netzunabhängigen Plattform.',
  'Durchsagen, Systemmonitoring, Crowd Management und Gerätesteuerung laufen bei NIKOS in einer einzigen, vom öffentlichen Netz unabhängigen Plattform zusammen.',
];

const USP_INTRO_TRANSLATIONS = {
  en: [
    'NIKOS combines announcements, alerting, visitor information and control in a single, network-independent platform.',
    'With NIKOS, announcements, system monitoring, visitor information and device control come together on a single platform — fully independent of the public network.',
    'One platform for everything: NIKOS unites visitor information, alerting, crowd management and control in a single, network-independent system.',
    'NIKOS brings together announcements, alerting, visitor guidance and device control in a single network-independent platform.',
    'Instead of multiple separate solutions: NIKOS unites visitor information, system monitoring, visitor guidance and control in a single network-independent platform.',
    'Announcements, system monitoring, crowd management and device control come together with NIKOS in a single platform independent of the public network.',
  ],
  fr: [
    'NIKOS réunit les annonces, l’alerte, l’information des visiteurs et le pilotage au sein d’une plateforme unique, indépendante des réseaux.',
    'Avec NIKOS, les annonces, la supervision du système, l’information des visiteurs et le pilotage des équipements se retrouvent sur une seule et même plateforme — totalement indépendante du réseau public.',
    'Une seule plateforme pour tout : NIKOS réunit l’information des visiteurs, l’alerte, le crowd management et le pilotage dans un système unique, indépendant du réseau.',
    'NIKOS regroupe les annonces, l’alerte, l’orientation des visiteurs et le pilotage des équipements au sein d’une plateforme unique et indépendante du réseau.',
    'Plutôt que plusieurs solutions séparées : NIKOS réunit l’information des visiteurs, la supervision du système, l’orientation des visiteurs et le pilotage au sein d’une plateforme unique et indépendante du réseau.',
    'Les annonces, la supervision du système, le crowd management et le pilotage des équipements se retrouvent chez NIKOS au sein d’une plateforme unique, indépendante du réseau public.',
  ],
  it: [
    'NIKOS riunisce annunci, allertamento, informazione dei visitatori e controllo in un\'unica piattaforma indipendente dalla rete.',
    'Con NIKOS, annunci, monitoraggio del sistema, informazione dei visitatori e controllo dei dispositivi confluiscono in un\'unica piattaforma — completamente indipendente dalla rete pubblica.',
    'Un\'unica piattaforma per tutto: NIKOS riunisce informazione dei visitatori, allertamento, crowd management e controllo in un sistema indipendente dalla rete.',
    'NIKOS integra annunci, allertamento, gestione dei flussi di visitatori e controllo dei dispositivi in un\'unica piattaforma indipendente dalla rete.',
    'Invece di più soluzioni separate: NIKOS riunisce informazione dei visitatori, monitoraggio del sistema, gestione dei flussi di visitatori e controllo in un\'unica piattaforma indipendente dalla rete.',
    'Annunci, monitoraggio del sistema, crowd management e controllo dei dispositivi confluiscono in NIKOS in un\'unica piattaforma indipendente dalla rete pubblica.',
  ],
  es: [
    'NIKOS reúne avisos, alarmas, información para visitantes y control en una única plataforma independiente de la red.',
    'Con NIKOS, avisos, monitorización del sistema, información para visitantes y control de dispositivos convergen en una única plataforma — totalmente independiente de la red pública.',
    'Una única plataforma para todo: NIKOS reúne información para visitantes, alarmas, crowd management y control en un sistema independiente de la red.',
    'NIKOS integra avisos, alarmas, orientación de visitantes y control de dispositivos en una única plataforma independiente de la red.',
    'En lugar de varias soluciones independientes: NIKOS reúne información para visitantes, monitorización del sistema, orientación de visitantes y control en una única plataforma independiente de la red.',
    'Avisos, monitorización del sistema, crowd management y control de dispositivos convergen en NIKOS en una única plataforma independiente de la red pública.',
  ],
  nl: [
    'NIKOS bundelt omroepberichten, alarmering, bezoekersinformatie en besturing in één enkel, netonafhankelijk platform.',
    'Met NIKOS komen omroepberichten, systeemmonitoring, bezoekersinformatie en apparaatbesturing samen op één platform — volledig onafhankelijk van het openbare netwerk.',
    'Eén platform voor alles: NIKOS verenigt bezoekersinformatie, alarmering, crowd management en besturing netonafhankelijk in één systeem.',
    'NIKOS brengt omroepberichten, alarmering, bezoekersgeleiding en apparaatbesturing samen in één netonafhankelijk platform.',
    'In plaats van meerdere aparte oplossingen: NIKOS verenigt bezoekersinformatie, systeemmonitoring, bezoekersgeleiding en besturing in één netonafhankelijk platform.',
    'Omroepberichten, systeemmonitoring, crowd management en apparaatbesturing komen bij NIKOS samen in één platform, onafhankelijk van het openbare netwerk.',
  ],
  da: [
    'NIKOS samler meddelelser, alarmering, besøgsinformation og styring i én samlet, netuafhængig platform.',
    'Med NIKOS samles meddelelser, systemovervågning, besøgsinformation og enhedsstyring på én platform — fuldstændig uafhængig af det offentlige net.',
    'Én platform til alt: NIKOS forener besøgsinformation, alarmering, crowd management og styring netuafhængigt i ét system.',
    'NIKOS bringer meddelelser, alarmering, besøgsstyring og enhedsstyring sammen i én netuafhængig platform.',
    'I stedet for flere enkeltløsninger: NIKOS forener besøgsinformation, systemovervågning, besøgsstyring og styring i én netuafhængig platform.',
    'Meddelelser, systemovervågning, crowd management og enhedsstyring samles hos NIKOS i én platform, uafhængig af det offentlige net.',
  ],
  pl: [
    'NIKOS łączy komunikaty, alarmowanie, informowanie uczestników i sterowanie w jednej, niezależnej od sieci platformie.',
    'Dzięki NIKOS komunikaty, monitoring systemu, informowanie uczestników i sterowanie urządzeniami są dostępne na jednej platformie — całkowicie niezależnej od sieci publicznej.',
    'Jedna platforma do wszystkiego: NIKOS łączy informowanie uczestników, alarmowanie, crowd management i sterowanie w jednym, niezależnym od sieci systemie.',
    'NIKOS integruje komunikaty, alarmowanie, kierowanie ruchem odwiedzających i sterowanie urządzeniami w jednej, niezależnej od sieci platformie.',
    'Zamiast kilku osobnych rozwiązań: NIKOS łączy informowanie uczestników, monitoring systemu, kierowanie ruchem odwiedzających i sterowanie w jednej, niezależnej od sieci platformie.',
    'Komunikaty, monitoring systemu, crowd management i sterowanie urządzeniami łączą się w NIKOS w jednej platformie, niezależnej od sieci publicznej.',
  ],
};

// ── FAQ1 — Frage (6 Varianten je Sprache) ───────────────────────────────

const FAQ1_Q_DE_VARIANTS = [
  'Entsprechen Durchsagen mit NIKOS den geltenden Normen?',
  'Erfüllt NIKOS bei Durchsagen die geltenden Normen?',
  'Sind Durchsagen über NIKOS normkonform?',
  'Ist NIKOS für Durchsagen normgerecht ausgelegt?',
  'Hält sich NIKOS bei Durchsagen an die geltenden Normen?',
  'Erfüllen NIKOS-Durchsagen die einschlägigen Normanforderungen?',
];

const FAQ1_Q_TRANSLATIONS = {
  en: [
    'Do announcements made with NIKOS comply with the applicable standards?',
    'Does NIKOS meet the applicable standards for announcements?',
    'Are announcements made via NIKOS standard-compliant?',
    'Is NIKOS designed to meet the relevant standards for announcements?',
    'Does NIKOS adhere to the applicable standards for announcements?',
    'Do NIKOS announcements meet the relevant standard requirements?',
  ],
  fr: [
    'Les annonces diffusées avec NIKOS sont-elles conformes aux normes en vigueur ?',
    'NIKOS respecte-t-il les normes en vigueur pour les annonces ?',
    'Les annonces via NIKOS sont-elles conformes aux normes ?',
    'NIKOS est-il conçu conformément aux normes pour les annonces ?',
    'NIKOS respecte-t-il les normes en vigueur en matière d’annonces ?',
    'Les annonces NIKOS répondent-elles aux exigences normatives applicables ?',
  ],
  it: [
    'Gli annunci effettuati con NIKOS sono conformi alle norme vigenti?',
    'NIKOS rispetta le norme vigenti per gli annunci?',
    'Gli annunci tramite NIKOS sono conformi alle norme?',
    'NIKOS è progettato in conformità alle norme per gli annunci?',
    'NIKOS si attiene alle norme vigenti per gli annunci?',
    'Gli annunci NIKOS soddisfano i requisiti normativi pertinenti?',
  ],
  es: [
    '¿Los avisos emitidos con NIKOS cumplen las normas vigentes?',
    '¿NIKOS cumple las normas vigentes en materia de avisos?',
    '¿Los avisos a través de NIKOS son conformes a las normas?',
    '¿Está NIKOS diseñado conforme a las normas para los avisos?',
    '¿NIKOS respeta las normas vigentes para los avisos?',
    '¿Los avisos de NIKOS cumplen los requisitos normativos pertinentes?',
  ],
  nl: [
    'Voldoen omroepberichten met NIKOS aan de geldende normen?',
    'Voldoet NIKOS bij omroepberichten aan de geldende normen?',
    'Zijn omroepberichten via NIKOS normconform?',
    'Is NIKOS voor omroepberichten normconform ontworpen?',
    'Houdt NIKOS zich bij omroepberichten aan de geldende normen?',
    'Voldoen NIKOS-omroepberichten aan de relevante normvereisten?',
  ],
  da: [
    'Opfylder meddelelser med NIKOS de gældende standarder?',
    'Overholder NIKOS de gældende standarder for meddelelser?',
    'Er meddelelser via NIKOS standardkonforme?',
    'Er NIKOS udviklet i overensstemmelse med standarderne for meddelelser?',
    'Overholder NIKOS de gældende standarder ved meddelelser?',
    'Opfylder NIKOS-meddelelser de relevante standardkrav?',
  ],
  pl: [
    'Czy komunikaty nadawane za pomocą NIKOS są zgodne z obowiązującymi normami?',
    'Czy NIKOS spełnia obowiązujące normy w zakresie komunikatów?',
    'Czy komunikaty za pomocą NIKOS są zgodne z normami?',
    'Czy NIKOS jest zaprojektowany zgodnie z normami dotyczącymi komunikatów?',
    'Czy NIKOS przestrzega obowiązujących norm w zakresie komunikatów?',
    'Czy komunikaty NIKOS spełniają odpowiednie wymagania normatywne?',
  ],
};

// ── FAQ1 — Antwort: NUR Kernblock (6 Varianten je Sprache), Schlusssatz separat ──

const FAQ1_A_DE_VARIANTS = [
  'Ja. NIKOS erfüllt die Anforderungen der DIN EN 50849 (Elektroakustische Notfallwarnsysteme). NIKOS wurde speziell für sicherheitsrelevante Durchsage- und Alarmierungsanwendungen entwickelt und ist technisch für den Einsatz in Alltags- und Notfallsituationen ausgelegt. Für elektroakustische Notfallwarnsysteme (ELA-Anlagen) ist die DIN EN 50849 der maßgebliche Orientierungsrahmen. Die dort genannten Anforderungen werden von NIKOS – im Gegensatz zu mobilfunkbasierten Systemen – voll erfüllt, da keine Abhängigkeit von einem fremden Netz besteht und somit jederzeit eine sofortige Nutzbarkeit gewährleistet werden kann. Andere aus der Sicherheitstechnik bekannte Normen wie die DIN EN 54, DIN VDE 0833-4 sowie DIN 14675 (Sprachalarmierungsanlagen) sind auf das Einsatzgebiet und Funktionsspektrum von NIKOS nicht anwendbar und daher für eine Genehmigung nicht relevant. NIKOS ist das marktführende Durchsagesystem für temporäre und mobile Anwendungen und seit 2017 vielfach erfolgreich für die Umsetzung einsatzkritischer Kommunikationsaufgaben im Einsatz.',
  'Ja, NIKOS ist normkonform: Das System erfüllt die DIN EN 50849 für elektroakustische Notfallwarnsysteme. Entwickelt wurde NIKOS gezielt für sicherheitsrelevante Durchsagen und Alarmierungen — einsetzbar sowohl im Alltagsbetrieb als auch im Notfall. Bei ELA-Anlagen bildet die DIN EN 50849 den entscheidenden Bezugsrahmen. Anders als mobilfunkbasierte Systeme erfüllt NIKOS diese Anforderungen vollständig, weil es unabhängig von einem externen Netz arbeitet und dadurch jederzeit sofort einsatzbereit ist. Für NIKOS nicht einschlägig sind dagegen andere sicherheitstechnische Normen wie DIN EN 54, DIN VDE 0833-4 und DIN 14675 (Sprachalarmierungsanlagen), da sie ein anderes Einsatzgebiet und einen anderen Funktionsumfang betreffen. Als marktführendes Durchsagesystem für temporäre und mobile Einsätze ist NIKOS seit 2017 bereits vielfach erfolgreich für einsatzkritische Kommunikationsaufgaben im Einsatz gewesen.',
  'Ja — die DIN EN 50849 (elektroakustische Notfallwarnsysteme) wird von NIKOS vollständig erfüllt. Konzipiert wurde das System speziell für sicherheitsrelevante Durchsage- und Alarmierungsaufgaben, technisch ausgelegt für den täglichen Betrieb genauso wie für Notfälle. Für ELA-Anlagen gibt die DIN EN 50849 den maßgeblichen Rahmen vor. Weil NIKOS – anders als mobilfunkbasierte Lösungen – von keinem externen Netz abhängig ist, ist es jederzeit sofort nutzbar und erfüllt die in der Norm geforderten Voraussetzungen vollständig. Andere sicherheitstechnische Normen wie DIN EN 54, DIN VDE 0833-4 oder DIN 14675 (Sprachalarmierungsanlagen) betreffen ein anderes Einsatzgebiet und Funktionsspektrum und sind für NIKOS entsprechend nicht relevant für eine Genehmigung. Seit 2017 ist NIKOS als marktführendes Durchsagesystem für temporäre und mobile Anwendungen vielfach erfolgreich bei einsatzkritischen Kommunikationsaufgaben im Einsatz.',
  'Ja, dem ist so: NIKOS erfüllt die Vorgaben der DIN EN 50849 für elektroakustische Notfallwarnsysteme. Das System wurde eigens für sicherheitsrelevante Durchsagen und Alarmierungen entwickelt und ist sowohl für den Alltagsbetrieb als auch für Notfallsituationen technisch ausgelegt. Die DIN EN 50849 stellt dabei den maßgeblichen Orientierungsrahmen für ELA-Anlagen dar. Im Unterschied zu mobilfunkbasierten Systemen hängt NIKOS von keinem fremden Netz ab und ist deshalb jederzeit sofort einsatzbereit — die Norm wird dadurch vollständig erfüllt. Nicht anwendbar auf NIKOS sind hingegen andere aus der Sicherheitstechnik bekannte Normen wie DIN EN 54, DIN VDE 0833-4 und DIN 14675 (Sprachalarmierungsanlagen), da sie nicht auf funkbasierte Durchsagesysteme wie NIKOS anwendbar sind. NIKOS gilt als marktführendes Durchsagesystem für temporäre und mobile Anwendungen und kommt seit 2017 vielfach erfolgreich bei einsatzkritischen Kommunikationsaufgaben zum Einsatz.',
  'Ja. Grundlage ist die DIN EN 50849 für elektroakustische Notfallwarnsysteme, deren Anforderungen NIKOS vollständig erfüllt. Speziell entwickelt für sicherheitsrelevante Durchsage- und Alarmierungsanwendungen, ist NIKOS technisch für Alltags- ebenso wie für Notfallsituationen ausgelegt. Bei ELA-Anlagen bildet die DIN EN 50849 den maßgeblichen Rahmen. Da NIKOS – anders als mobilfunkbasierte Systeme – nicht von einem fremden Netz abhängt, ist eine sofortige Nutzbarkeit jederzeit gewährleistet, wodurch die Norm vollumfänglich erfüllt wird. Andere sicherheitstechnische Normen wie DIN EN 54, DIN VDE 0833-4 sowie DIN 14675 (Sprachalarmierungsanlagen) betreffen ein anderes Einsatzgebiet und Funktionsspektrum und sind für eine Genehmigung von NIKOS nicht relevant. Seit seiner Markteinführung 2017 ist NIKOS als führendes Durchsagesystem für temporäre und mobile Anwendungen auf einigen der größten Open-Air-Veranstaltungen Europas erfolgreich im Einsatz.',
  'Ja, NIKOS erfüllt die DIN EN 50849 „Elektroakustische Notfallwarnsysteme“ vollständig. Das System wurde gezielt für sicherheitsrelevante Durchsagen und Alarmierungen konzipiert und ist technisch sowohl für den Alltag als auch für den Notfall ausgelegt. Die DIN EN 50849 ist die für funkgestützte ELA-Anlagen wie NIKOS maßgebliche Norm. Weil NIKOS im Gegensatz zu mobilfunkbasierten Systemen unabhängig von einem externen Netz funktioniert, ist eine sofortige Nutzbarkeit jederzeit gegeben — die Normanforderungen werden dadurch vollständig erfüllt. Nicht einschlägig für NIKOS sind demgegenüber andere sicherheitstechnische Normen wie DIN EN 54, DIN VDE 0833-4 und DIN 14675 (Sprachalarmierungsanlagen), da sie ein anderes Einsatzgebiet und einen anderen Funktionsumfang betreffen und für den Einsatz von NIKOS daher nicht relevant sind. Als bisher einziges konsequent an den Anforderungen einsatzkritischer Anwendungen orientiertes Durchsagesystem für temporäre und mobile Anwendungen ist NIKOS seit 2017 vielfach erfolgreich für krisensichere Kommunikationsaufgaben im Einsatz.',
];

const FAQ1_A_CLOSING_DE = 'RADACOM und Ihr regionaler NIKOS-Partner beraten Sie gerne zu den vielfältigen Funktionen von NIKOS und unterstützen Sie bei der kostenschonenden Umsetzung der Anforderungen.';

const FAQ1_A_TRANSLATIONS = {
  en: [
    'Yes. NIKOS meets the requirements of DIN EN 50849 (electroacoustic emergency warning systems). NIKOS was developed specifically for safety-relevant public address and alerting applications and is technically designed for use in both everyday and emergency situations. For electroacoustic emergency warning systems, DIN EN 50849 is the relevant reference framework. Unlike mobile network-based systems, NIKOS fully meets the requirements specified therein, as it does not depend on an external network and can therefore be used immediately at any time. Other standards known from safety technology, such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems), do not apply to the field of use and functional scope of NIKOS and are therefore not relevant for approval. NIKOS is the market-leading public address system for temporary and mobile applications and has been successfully deployed in numerous mission-critical communication tasks since 2017.',
    'Yes, NIKOS is standard-compliant: the system meets DIN EN 50849 for electroacoustic emergency warning systems. NIKOS was developed specifically for safety-relevant announcements and alerting — usable both in everyday operation and in an emergency. For ELA systems, DIN EN 50849 forms the decisive reference framework. Unlike mobile network-based systems, NIKOS fully meets these requirements because it operates independently of an external network and is therefore immediately ready for use at any time. Other safety-related standards such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems) do not apply to NIKOS, since they concern a different field of use and functional scope. As the market-leading public address system for temporary and mobile deployments, NIKOS has already been used successfully many times for mission-critical communication tasks since 2017.',
    'Yes — NIKOS fully meets DIN EN 50849 (electroacoustic emergency warning systems). The system was designed specifically for safety-relevant announcement and alerting tasks, technically built for everyday operation as well as for emergencies. For ELA systems, DIN EN 50849 sets out the relevant framework. Because NIKOS — unlike mobile network-based solutions — does not depend on any external network, it is always immediately usable and fully meets the requirements set out in the standard. Other safety-related standards such as DIN EN 54, DIN VDE 0833-4 or DIN 14675 (voice alarm systems) concern a different field of use and functional scope and are therefore not relevant for NIKOS in terms of approval. Since 2017, NIKOS has been used successfully many times as the market-leading public address system for temporary and mobile applications in mission-critical communication tasks.',
    'Yes, indeed: NIKOS meets the requirements of DIN EN 50849 for electroacoustic emergency warning systems. The system was developed specifically for safety-relevant announcements and alerting and is technically designed for both everyday operation and emergency situations. DIN EN 50849 represents the relevant reference framework for ELA systems. Unlike mobile network-based systems, NIKOS does not depend on any external network and is therefore immediately ready for use at all times — fully meeting the standard as a result. Other standards known from safety technology, such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems), do not apply to NIKOS, as they are not applicable to radio-based public address systems like NIKOS. NIKOS is regarded as the market-leading public address system for temporary and mobile applications and has been used successfully many times for mission-critical communication tasks since 2017.',
    'Yes. The basis is DIN EN 50849 for electroacoustic emergency warning systems, whose requirements NIKOS fully meets. Developed specifically for safety-relevant announcement and alerting applications, NIKOS is technically designed for everyday use as well as for emergency situations. For ELA systems, DIN EN 50849 forms the relevant framework. Because NIKOS — unlike mobile network-based systems — does not depend on an external network, immediate usability is guaranteed at all times, meaning the standard is fully met. Other safety-related standards such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems) concern a different field of use and functional scope and are not relevant for the approval of NIKOS. Since its market launch in 2017, NIKOS has been the leading public address system for temporary and mobile applications, used successfully at some of the largest open-air events in Europe.',
    'Yes, NIKOS fully meets DIN EN 50849 "Electroacoustic Emergency Warning Systems". The system was specifically designed for safety-relevant announcements and alerting and is technically built for both everyday and emergency use. DIN EN 50849 is the relevant standard for radio-based ELA systems such as NIKOS. Because NIKOS, unlike mobile network-based systems, operates independently of an external network, immediate usability is guaranteed at all times — fully meeting the standard\'s requirements as a result. Other safety-related standards such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems), by contrast, do not apply to NIKOS, as they concern a different field of use and functional scope and are therefore not relevant to NIKOS\'s deployment. As the only public address system for temporary and mobile applications consistently designed around the demands of mission-critical use, NIKOS has been used successfully for crisis-proof communication tasks since 2017.',
  ],
  fr: [
    'Oui. NIKOS satisfait aux exigences de la norme DIN EN 50849 (systèmes électroacoustiques d’alerte d’urgence). NIKOS a été spécialement développé pour les applications d’annonces et d’alerte liées à la sécurité, et est techniquement conçu pour une utilisation dans des situations courantes comme dans des situations d’urgence. Pour les systèmes électroacoustiques d’alerte d’urgence (installations ELA), la norme DIN EN 50849 constitue le cadre de référence déterminant. Contrairement aux systèmes reposant sur les réseaux mobiles, NIKOS répond intégralement aux exigences qui y sont mentionnées, car il ne dépend d’aucun réseau tiers et peut ainsi garantir une disponibilité immédiate à tout moment. D’autres normes connues dans le domaine de la sécurité, telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale), ne sont pas applicables au domaine d’utilisation ni au périmètre fonctionnel de NIKOS et ne sont donc pas pertinentes pour une autorisation. NIKOS est le système d’annonces leader du marché pour les applications temporaires et mobiles, et est utilisé avec succès depuis 2017 pour la mise en œuvre de nombreuses missions de communication critiques.',
    'Oui, NIKOS est conforme aux normes : le système répond à la norme DIN EN 50849 relative aux systèmes électroacoustiques d’alerte d’urgence. NIKOS a été développé spécifiquement pour les annonces et alertes liées à la sécurité — utilisable aussi bien en exploitation courante qu’en situation d’urgence. Pour les installations ELA, la norme DIN EN 50849 constitue le cadre de référence déterminant. Contrairement aux systèmes reposant sur les réseaux mobiles, NIKOS répond intégralement à ces exigences car il fonctionne indépendamment de tout réseau externe et est ainsi immédiatement opérationnel à tout moment. D’autres normes de sécurité telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale) ne s’appliquent en revanche pas à NIKOS, car elles concernent un autre domaine d’utilisation et un autre périmètre fonctionnel. En tant que système d’annonces leader du marché pour les déploiements temporaires et mobiles, NIKOS est déjà utilisé avec succès à de nombreuses reprises pour des missions de communication critiques depuis 2017.',
    'Oui — NIKOS satisfait pleinement à la norme DIN EN 50849 (systèmes électroacoustiques d’alerte d’urgence). Le système a été conçu spécifiquement pour les missions d’annonces et d’alerte liées à la sécurité, techniquement adapté aussi bien à l’exploitation quotidienne qu’aux situations d’urgence. Pour les installations ELA, la norme DIN EN 50849 fixe le cadre déterminant. Parce que NIKOS — contrairement aux solutions reposant sur les réseaux mobiles — ne dépend d’aucun réseau externe, il est utilisable immédiatement à tout moment et satisfait intégralement aux exigences fixées par la norme. D’autres normes de sécurité telles que DIN EN 54, DIN VDE 0833-4 ou DIN 14675 (systèmes d’alarme vocale) concernent un autre domaine d’utilisation et un autre périmètre fonctionnel et ne sont donc pas pertinentes pour NIKOS en matière d’autorisation. Depuis 2017, NIKOS est utilisé avec succès à de nombreuses reprises en tant que système d’annonces leader du marché pour les applications temporaires et mobiles, pour des missions de communication critiques.',
    'Oui, en effet : NIKOS répond aux exigences de la norme DIN EN 50849 relative aux systèmes électroacoustiques d’alerte d’urgence. Le système a été spécialement développé pour les annonces et alertes liées à la sécurité et est techniquement conçu aussi bien pour l’exploitation courante que pour les situations d’urgence. La norme DIN EN 50849 constitue à cet égard le cadre de référence déterminant pour les installations ELA. Contrairement aux systèmes reposant sur les réseaux mobiles, NIKOS ne dépend d’aucun réseau tiers et est donc immédiatement opérationnel à tout moment — la norme est ainsi pleinement respectée. D’autres normes connues dans le domaine de la sécurité, telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale), ne sont en revanche pas applicables à NIKOS, car elles ne s’appliquent pas aux systèmes d’annonces radioélectriques tels que NIKOS. NIKOS est considéré comme le système d’annonces leader du marché pour les applications temporaires et mobiles et est utilisé avec succès à de nombreuses reprises pour des missions de communication critiques depuis 2017.',
    'Oui. La base est la norme DIN EN 50849 relative aux systèmes électroacoustiques d’alerte d’urgence, dont NIKOS satisfait intégralement les exigences. Spécialement conçu pour les applications d’annonces et d’alerte liées à la sécurité, NIKOS est techniquement adapté aussi bien à l’exploitation courante qu’aux situations d’urgence. Pour les installations ELA, la norme DIN EN 50849 constitue le cadre déterminant. Parce que NIKOS — contrairement aux systèmes reposant sur les réseaux mobiles — ne dépend d’aucun réseau externe, une disponibilité immédiate est garantie à tout moment, ce qui permet de satisfaire pleinement à la norme. D’autres normes de sécurité telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale) concernent un autre domaine d’utilisation et un autre périmètre fonctionnel et ne sont pas pertinentes pour l’autorisation de NIKOS. Depuis son lancement sur le marché en 2017, NIKOS s’est imposé comme le système d’annonces leader pour les applications temporaires et mobiles, utilisé avec succès lors de certains des plus grands événements en plein air d’Europe.',
    'Oui, NIKOS satisfait pleinement à la norme DIN EN 50849 « Systèmes électroacoustiques d’alerte d’urgence ». Le système a été spécialement conçu pour les annonces et alertes liées à la sécurité et est techniquement adapté aussi bien au quotidien qu’aux situations d’urgence. La norme DIN EN 50849 est la norme déterminante pour les installations ELA radioélectriques telles que NIKOS. Parce que NIKOS, contrairement aux systèmes reposant sur les réseaux mobiles, fonctionne indépendamment de tout réseau externe, une disponibilité immédiate est garantie à tout moment — les exigences de la norme sont ainsi pleinement satisfaites. D’autres normes de sécurité telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale) ne sont en revanche pas applicables à NIKOS, car elles concernent un autre domaine d’utilisation et un autre périmètre fonctionnel et ne sont donc pas pertinentes pour l’utilisation de NIKOS. Seul système d’annonces pour applications temporaires et mobiles conçu de façon cohérente autour des exigences des usages critiques, NIKOS est utilisé avec succès depuis 2017 pour des missions de communication fiables en situation de crise.',
  ],
  it: [
    'Sì. NIKOS soddisfa i requisiti della DIN EN 50849 (sistemi elettroacustici di allarme di emergenza). NIKOS è stato sviluppato specificamente per applicazioni di annunci e allertamento rilevanti per la sicurezza ed è tecnicamente progettato per l\'impiego in situazioni ordinarie e di emergenza. Per i sistemi elettroacustici di allarme di emergenza (impianti ELA), la DIN EN 50849 costituisce il principale quadro di riferimento. I requisiti ivi indicati sono pienamente soddisfatti da NIKOS, a differenza dei sistemi basati sulla telefonia mobile, poiché non vi è alcuna dipendenza da una rete esterna e può quindi essere garantita l\'utilizzabilità immediata in qualsiasi momento. Altre norme note nell\'ambito della tecnologia di sicurezza, quali DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale), non sono applicabili al campo d\'impiego e alla gamma di funzioni di NIKOS e non sono pertanto rilevanti ai fini dell\'autorizzazione. NIKOS è il sistema di diffusione sonora leader di mercato per applicazioni temporanee e mobili e dal 2017 viene impiegato con successo in numerose occasioni per realizzare compiti di comunicazione critici per le operazioni.',
    'Sì, NIKOS è conforme alle norme: il sistema soddisfa la DIN EN 50849 per i sistemi elettroacustici di allarme di emergenza. NIKOS è stato sviluppato appositamente per annunci e allertamenti rilevanti per la sicurezza — utilizzabile sia nell\'esercizio quotidiano sia in caso di emergenza. Per gli impianti ELA, la DIN EN 50849 costituisce il quadro di riferimento determinante. A differenza dei sistemi basati sulla telefonia mobile, NIKOS soddisfa pienamente questi requisiti perché opera in modo indipendente da una rete esterna ed è quindi immediatamente operativo in qualsiasi momento. Altre norme di sicurezza come DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale) non sono invece pertinenti per NIKOS, poiché riguardano un diverso campo d\'impiego e un diverso ambito funzionale. In qualità di sistema di diffusione sonora leader di mercato per impieghi temporanei e mobili, NIKOS è già stato impiegato con successo in numerose occasioni per compiti di comunicazione critici dal 2017.',
    'Sì — la DIN EN 50849 (sistemi elettroacustici di allarme di emergenza) è pienamente soddisfatta da NIKOS. Il sistema è stato concepito specificamente per compiti di annuncio e allertamento rilevanti per la sicurezza, tecnicamente predisposto sia per l\'esercizio quotidiano sia per le emergenze. Per gli impianti ELA, la DIN EN 50849 definisce il quadro di riferimento determinante. Poiché NIKOS — a differenza delle soluzioni basate sulla telefonia mobile — non dipende da alcuna rete esterna, è sempre immediatamente utilizzabile e soddisfa pienamente i requisiti previsti dalla norma. Altre norme di sicurezza come DIN EN 54, DIN VDE 0833-4 o DIN 14675 (impianti di allarme vocale) riguardano un diverso campo d\'impiego e un diverso ambito funzionale e non sono pertanto rilevanti per NIKOS ai fini dell\'autorizzazione. Dal 2017 NIKOS viene impiegato con successo in numerose occasioni come sistema di diffusione sonora leader di mercato per applicazioni temporanee e mobili, per compiti di comunicazione critici.',
    'Sì, esattamente: NIKOS soddisfa i requisiti della DIN EN 50849 per i sistemi elettroacustici di allarme di emergenza. Il sistema è stato sviluppato appositamente per annunci e allertamenti rilevanti per la sicurezza ed è tecnicamente predisposto sia per l\'esercizio quotidiano sia per le situazioni di emergenza. La DIN EN 50849 costituisce a tale riguardo il quadro di riferimento determinante per gli impianti ELA. A differenza dei sistemi basati sulla telefonia mobile, NIKOS non dipende da alcuna rete esterna ed è quindi sempre immediatamente operativo — la norma risulta così pienamente soddisfatta. Altre norme note nell\'ambito della tecnologia di sicurezza, come DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale), non sono invece applicabili a NIKOS, poiché non si applicano a sistemi di diffusione sonora via radio come NIKOS. NIKOS è considerato il sistema di diffusione sonora leader di mercato per applicazioni temporanee e mobili e viene impiegato con successo in numerose occasioni per compiti di comunicazione critici dal 2017.',
    'Sì. Alla base vi è la DIN EN 50849 per i sistemi elettroacustici di allarme di emergenza, i cui requisiti sono pienamente soddisfatti da NIKOS. Sviluppato appositamente per applicazioni di annuncio e allertamento rilevanti per la sicurezza, NIKOS è tecnicamente predisposto sia per l\'uso quotidiano sia per le situazioni di emergenza. Per gli impianti ELA, la DIN EN 50849 costituisce il quadro di riferimento determinante. Poiché NIKOS — a differenza dei sistemi basati sulla telefonia mobile — non dipende da una rete esterna, l\'utilizzabilità immediata è garantita in qualsiasi momento, soddisfacendo così pienamente la norma. Altre norme di sicurezza come DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale) riguardano un diverso campo d\'impiego e un diverso ambito funzionale e non sono rilevanti ai fini dell\'autorizzazione di NIKOS. Dal suo lancio sul mercato nel 2017, NIKOS si è affermato come il sistema di diffusione sonora leader per applicazioni temporanee e mobili, impiegato con successo in alcuni dei più grandi eventi all\'aperto d\'Europa.',
    'Sì, NIKOS soddisfa pienamente la DIN EN 50849 «Sistemi elettroacustici di allarme di emergenza». Il sistema è stato concepito appositamente per annunci e allertamenti rilevanti per la sicurezza ed è tecnicamente predisposto sia per l\'uso quotidiano sia per l\'emergenza. La DIN EN 50849 è la norma determinante per gli impianti ELA via radio come NIKOS. Poiché NIKOS, a differenza dei sistemi basati sulla telefonia mobile, funziona in modo indipendente da una rete esterna, l\'utilizzabilità immediata è garantita in qualsiasi momento — i requisiti della norma risultano così pienamente soddisfatti. Altre norme di sicurezza come DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale) non sono invece pertinenti per NIKOS, poiché riguardano un diverso campo d\'impiego e un diverso ambito funzionale e non sono pertanto rilevanti per l\'impiego di NIKOS. In quanto unico sistema di diffusione sonora per applicazioni temporanee e mobili concepito in modo coerente attorno alle esigenze degli impieghi critici, NIKOS viene utilizzato con successo dal 2017 per compiti di comunicazione affidabili in situazioni di crisi.',
  ],
  es: [
    'Sí. NIKOS cumple los requisitos de la DIN EN 50849 (sistemas electroacústicos de alerta de emergencia). NIKOS se ha desarrollado específicamente para aplicaciones de avisos y alertas relevantes para la seguridad y está diseñado técnicamente para su uso en situaciones cotidianas y de emergencia. Para los sistemas electroacústicos de alerta de emergencia (instalaciones ELA), la DIN EN 50849 constituye el marco de referencia determinante. A diferencia de los sistemas basados en redes móviles, NIKOS cumple íntegramente los requisitos indicados en esta norma, ya que no depende de una red externa y, por tanto, puede garantizarse su disponibilidad inmediata en todo momento. Otras normas conocidas en el ámbito de la tecnología de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), no son aplicables al ámbito de uso ni al espectro funcional de NIKOS y, por lo tanto, no son relevantes a efectos de autorización. NIKOS es el sistema de megafonía líder del mercado para aplicaciones temporales y móviles, y desde 2017 se utiliza con éxito en numerosas ocasiones para llevar a cabo tareas de comunicación críticas para la operación.',
    'Sí, NIKOS cumple las normas: el sistema satisface la DIN EN 50849 para sistemas electroacústicos de alerta de emergencia. NIKOS se ha desarrollado específicamente para avisos y alertas relevantes para la seguridad — utilizable tanto en el funcionamiento cotidiano como en caso de emergencia. En las instalaciones ELA, la DIN EN 50849 constituye el marco de referencia determinante. A diferencia de los sistemas basados en redes móviles, NIKOS cumple íntegramente estos requisitos porque funciona con independencia de una red externa y, por ello, está siempre listo para su uso inmediato. Otras normas de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), no son en cambio relevantes para NIKOS, ya que se refieren a un ámbito de uso y un alcance funcional diferentes. Como sistema de megafonía líder del mercado para despliegues temporales y móviles, NIKOS ya se ha utilizado con éxito en numerosas ocasiones para tareas de comunicación críticas desde 2017.',
    'Sí — NIKOS cumple íntegramente la DIN EN 50849 (sistemas electroacústicos de alerta de emergencia). El sistema se ha concebido específicamente para tareas de avisos y alertas relevantes para la seguridad, diseñado técnicamente tanto para el funcionamiento cotidiano como para las emergencias. En las instalaciones ELA, la DIN EN 50849 establece el marco determinante. Dado que NIKOS —a diferencia de las soluciones basadas en redes móviles— no depende de ninguna red externa, está siempre disponible de forma inmediata y cumple íntegramente los requisitos establecidos en la norma. Otras normas de seguridad, como DIN EN 54, DIN VDE 0833-4 o DIN 14675 (sistemas de alarma por voz), se refieren a un ámbito de uso y un alcance funcional diferentes y, por tanto, no son relevantes para NIKOS a efectos de autorización. Desde 2017, NIKOS se utiliza con éxito en numerosas ocasiones como sistema de megafonía líder del mercado para aplicaciones temporales y móviles, para tareas de comunicación críticas.',
    'Sí, así es: NIKOS cumple los requisitos de la DIN EN 50849 para sistemas electroacústicos de alerta de emergencia. El sistema se ha desarrollado específicamente para avisos y alertas relevantes para la seguridad y está diseñado técnicamente tanto para el funcionamiento cotidiano como para situaciones de emergencia. La DIN EN 50849 constituye a este respecto el marco de referencia determinante para las instalaciones ELA. A diferencia de los sistemas basados en redes móviles, NIKOS no depende de ninguna red externa y, por ello, está siempre listo para su uso inmediato — con lo que la norma se cumple íntegramente. Otras normas conocidas en el ámbito de la tecnología de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), no son en cambio aplicables a NIKOS, ya que no se aplican a sistemas de megafonía basados en radio como NIKOS. NIKOS está considerado el sistema de megafonía líder del mercado para aplicaciones temporales y móviles y se utiliza con éxito en numerosas ocasiones para tareas de comunicación críticas desde 2017.',
    'Sí. La base es la DIN EN 50849 para sistemas electroacústicos de alerta de emergencia, cuyos requisitos NIKOS cumple íntegramente. Desarrollado específicamente para aplicaciones de avisos y alertas relevantes para la seguridad, NIKOS está diseñado técnicamente tanto para el uso cotidiano como para situaciones de emergencia. En las instalaciones ELA, la DIN EN 50849 constituye el marco determinante. Dado que NIKOS —a diferencia de los sistemas basados en redes móviles— no depende de una red externa, se garantiza la disponibilidad inmediata en todo momento, con lo que la norma se cumple plenamente. Otras normas de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), se refieren a un ámbito de uso y un alcance funcional diferentes y no son relevantes a efectos de autorización de NIKOS. Desde su lanzamiento al mercado en 2017, NIKOS se ha consolidado como el sistema de megafonía líder para aplicaciones temporales y móviles, utilizado con éxito en algunos de los mayores eventos al aire libre de Europa.',
    'Sí, NIKOS cumple íntegramente la DIN EN 50849 «Sistemas electroacústicos de alerta de emergencia». El sistema se ha concebido específicamente para avisos y alertas relevantes para la seguridad y está diseñado técnicamente tanto para el uso cotidiano como para la emergencia. La DIN EN 50849 es la norma determinante para las instalaciones ELA basadas en radio como NIKOS. Dado que NIKOS, a diferencia de los sistemas basados en redes móviles, funciona con independencia de una red externa, se garantiza la disponibilidad inmediata en todo momento — con lo que se cumplen íntegramente los requisitos de la norma. Otras normas de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), no son en cambio relevantes para NIKOS, ya que se refieren a un ámbito de uso y un alcance funcional diferentes y, por tanto, no son relevantes para el uso de NIKOS. Como único sistema de megafonía para aplicaciones temporales y móviles concebido de forma coherente en torno a las exigencias de los usos críticos, NIKOS se utiliza con éxito desde 2017 para tareas de comunicación fiables en situaciones de crisis.',
  ],
  nl: [
    'Ja. NIKOS voldoet aan de eisen van DIN EN 50849 (elektro-akoestische noodwaarschuwingssystemen). NIKOS is speciaal ontwikkeld voor veiligheidsrelevante omroep- en alarmeringstoepassingen en technisch ontworpen voor gebruik in alledaagse en noodsituaties. Voor elektro-akoestische noodwaarschuwingssystemen (ELA-installaties) is DIN EN 50849 het bepalende referentiekader. De daarin genoemde eisen worden door NIKOS – in tegenstelling tot systemen op basis van mobiele netwerken – volledig vervuld, omdat er geen afhankelijkheid van een extern netwerk bestaat en daardoor te allen tijde onmiddellijk gebruik kan worden gegarandeerd. Andere uit de veiligheidstechniek bekende normen, zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties), zijn niet van toepassing op het toepassingsgebied en het functiespectrum van NIKOS en daarom niet relevant voor een vergunning. NIKOS is het marktleidende omroepsysteem voor tijdelijke en mobiele toepassingen en wordt sinds 2017 vele malen met succes ingezet voor de uitvoering van inzetkritische communicatietaken.',
    'Ja, NIKOS voldoet aan de normen: het systeem voldoet aan DIN EN 50849 voor elektro-akoestische noodwaarschuwingssystemen. NIKOS is speciaal ontwikkeld voor veiligheidsrelevante omroepberichten en alarmering — inzetbaar zowel in het dagelijkse gebruik als in noodsituaties. Bij ELA-installaties vormt DIN EN 50849 het bepalende referentiekader. In tegenstelling tot systemen op basis van mobiele netwerken voldoet NIKOS volledig aan deze eisen, omdat het onafhankelijk van een extern netwerk werkt en daardoor te allen tijde direct inzetbaar is. Andere veiligheidstechnische normen zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties) zijn daarentegen niet van toepassing op NIKOS, omdat ze een ander toepassingsgebied en functiebereik betreffen. Als marktleidend omroepsysteem voor tijdelijke en mobiele inzet wordt NIKOS sinds 2017 al vele malen met succes gebruikt voor inzetkritische communicatietaken.',
    'Ja — NIKOS voldoet volledig aan DIN EN 50849 (elektro-akoestische noodwaarschuwingssystemen). Het systeem is speciaal ontworpen voor veiligheidsrelevante omroep- en alarmeringstaken, technisch geschikt voor zowel dagelijks gebruik als noodsituaties. Voor ELA-installaties geeft DIN EN 50849 het bepalende kader aan. Omdat NIKOS – in tegenstelling tot op mobiele netwerken gebaseerde oplossingen – niet afhankelijk is van een extern netwerk, is het te allen tijde direct bruikbaar en voldoet het volledig aan de in de norm gestelde eisen. Andere veiligheidstechnische normen zoals DIN EN 54, DIN VDE 0833-4 of DIN 14675 (spraakalarminstallaties) betreffen een ander toepassingsgebied en functiebereik en zijn daarom voor NIKOS niet relevant voor een vergunning. Sinds 2017 wordt NIKOS al vele malen met succes ingezet als marktleidend omroepsysteem voor tijdelijke en mobiele toepassingen, voor inzetkritische communicatietaken.',
    'Ja, dat klopt: NIKOS voldoet aan de eisen van DIN EN 50849 voor elektro-akoestische noodwaarschuwingssystemen. Het systeem is speciaal ontwikkeld voor veiligheidsrelevante omroepberichten en alarmering en is technisch geschikt voor zowel dagelijks gebruik als noodsituaties. DIN EN 50849 vormt daarbij het bepalende referentiekader voor ELA-installaties. In tegenstelling tot systemen op basis van mobiele netwerken is NIKOS niet afhankelijk van een extern netwerk en daardoor te allen tijde direct inzetbaar — de norm wordt daardoor volledig vervuld. Andere uit de veiligheidstechniek bekende normen, zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties), zijn daarentegen niet van toepassing op NIKOS, omdat ze niet van toepassing zijn op radiogebaseerde omroepsystemen zoals NIKOS. NIKOS geldt als het marktleidende omroepsysteem voor tijdelijke en mobiele toepassingen en wordt sinds 2017 al vele malen met succes ingezet voor inzetkritische communicatietaken.',
    'Ja. De basis is DIN EN 50849 voor elektro-akoestische noodwaarschuwingssystemen, waarvan NIKOS de eisen volledig vervult. Speciaal ontwikkeld voor veiligheidsrelevante omroep- en alarmeringstoepassingen, is NIKOS technisch geschikt voor zowel dagelijks gebruik als noodsituaties. Bij ELA-installaties vormt DIN EN 50849 het bepalende kader. Omdat NIKOS – in tegenstelling tot systemen op basis van mobiele netwerken – niet afhankelijk is van een extern netwerk, is directe bruikbaarheid te allen tijde gegarandeerd, waardoor volledig aan de norm wordt voldaan. Andere veiligheidstechnische normen zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties) betreffen een ander toepassingsgebied en functiebereik en zijn niet relevant voor een vergunning van NIKOS. Sinds de marktintroductie in 2017 wordt NIKOS als toonaangevend omroepsysteem voor tijdelijke en mobiele toepassingen met succes ingezet bij enkele van de grootste openluchtevenementen van Europa.',
    'Ja, NIKOS voldoet volledig aan DIN EN 50849 „Elektro-akoestische noodwaarschuwingssystemen“. Het systeem is speciaal ontworpen voor veiligheidsrelevante omroepberichten en alarmering en is technisch geschikt voor zowel het dagelijks gebruik als noodsituaties. DIN EN 50849 is de bepalende norm voor radiogebaseerde ELA-installaties zoals NIKOS. Omdat NIKOS, in tegenstelling tot systemen op basis van mobiele netwerken, onafhankelijk van een extern netwerk functioneert, is directe bruikbaarheid te allen tijde gegarandeerd — de normvereisten worden daardoor volledig vervuld. Andere veiligheidstechnische normen zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties) zijn daarentegen niet van toepassing op NIKOS, omdat ze een ander toepassingsgebied en functiebereik betreffen en daarom niet relevant zijn voor de inzet van NIKOS. Als enige omroepsysteem voor tijdelijke en mobiele toepassingen dat consequent is afgestemd op de eisen van inzetkritische toepassingen, wordt NIKOS sinds 2017 met succes ingezet voor crisisbestendige communicatietaken.',
  ],
  da: [
    'Ja. NIKOS opfylder kravene i DIN EN 50849 (elektroakustiske nødvarslingssystemer). NIKOS er udviklet specifikt til sikkerhedskritiske meddelelses- og alarmeringsanvendelser og er teknisk designet til brug i både hverdags- og nødsituationer. For elektroakustiske nødvarslingssystemer (ELA-anlæg) er DIN EN 50849 den afgørende referenceramme. Kravene heri opfyldes fuldt ud af NIKOS – i modsætning til mobilnetbaserede systemer – da der ikke er afhængighed af et eksternt net, og øjeblikkelig anvendelighed dermed kan sikres til enhver tid. Andre standarder, der kendes fra sikkerhedsteknikken, såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg), er ikke anvendelige på NIKOS\' anvendelsesområde og funktionsomfang og er derfor ikke relevante for en godkendelse. NIKOS er det markedsførende meddelelsessystem til midlertidige og mobile anvendelser og har siden 2017 været anvendt med succes til udførelse af indsatskritiske kommunikationsopgaver.',
    'Ja, NIKOS er standardkonform: systemet opfylder DIN EN 50849 for elektroakustiske nødvarslingssystemer. NIKOS er udviklet specifikt til sikkerhedskritiske meddelelser og alarmering — anvendelig både i daglig drift og i en nødsituation. Ved ELA-anlæg udgør DIN EN 50849 den afgørende referenceramme. I modsætning til mobilnetbaserede systemer opfylder NIKOS disse krav fuldt ud, fordi det fungerer uafhængigt af et eksternt net og derfor til enhver tid er øjeblikkeligt klar til brug. Andre sikkerhedstekniske standarder såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg) er derimod ikke relevante for NIKOS, da de vedrører et andet anvendelsesområde og funktionsomfang. Som det markedsførende meddelelsessystem til midlertidige og mobile anvendelser er NIKOS allerede blevet anvendt med succes mange gange til indsatskritiske kommunikationsopgaver siden 2017.',
    'Ja — DIN EN 50849 (elektroakustiske nødvarslingssystemer) opfyldes fuldt ud af NIKOS. Systemet er udviklet specifikt til sikkerhedskritiske meddelelses- og alarmeringsopgaver, teknisk designet til både daglig drift og nødsituationer. For ELA-anlæg angiver DIN EN 50849 den afgørende ramme. Fordi NIKOS – i modsætning til mobilnetbaserede løsninger – ikke er afhængig af noget eksternt net, er det til enhver tid øjeblikkeligt anvendeligt og opfylder fuldt ud de krav, der stilles i standarden. Andre sikkerhedstekniske standarder såsom DIN EN 54, DIN VDE 0833-4 eller DIN 14675 (talevarslingsanlæg) vedrører et andet anvendelsesområde og funktionsomfang og er derfor ikke relevante for en godkendelse af NIKOS. Siden 2017 er NIKOS blevet anvendt med succes mange gange som det markedsførende meddelelsessystem til midlertidige og mobile anvendelser, til indsatskritiske kommunikationsopgaver.',
    'Ja, det er korrekt: NIKOS opfylder kravene i DIN EN 50849 for elektroakustiske nødvarslingssystemer. Systemet er udviklet specifikt til sikkerhedskritiske meddelelser og alarmering og er teknisk designet til både daglig drift og nødsituationer. DIN EN 50849 udgør her den afgørende referenceramme for ELA-anlæg. I modsætning til mobilnetbaserede systemer er NIKOS ikke afhængig af noget eksternt net og er derfor til enhver tid øjeblikkeligt klar til brug — standarden opfyldes dermed fuldt ud. Andre standarder, der kendes fra sikkerhedsteknikken, såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg), er derimod ikke anvendelige på NIKOS, da de ikke gælder for radiobaserede meddelelsessystemer som NIKOS. NIKOS anses for det markedsførende meddelelsessystem til midlertidige og mobile anvendelser og anvendes med succes mange gange til indsatskritiske kommunikationsopgaver siden 2017.',
    'Ja. Grundlaget er DIN EN 50849 for elektroakustiske nødvarslingssystemer, hvis krav NIKOS opfylder fuldt ud. Udviklet specifikt til sikkerhedskritiske meddelelses- og alarmeringsanvendelser er NIKOS teknisk designet til både daglig brug og nødsituationer. Ved ELA-anlæg udgør DIN EN 50849 den afgørende ramme. Fordi NIKOS – i modsætning til mobilnetbaserede systemer – ikke er afhængig af et eksternt net, er øjeblikkelig anvendelighed sikret til enhver tid, hvorved standarden opfyldes fuldt ud. Andre sikkerhedstekniske standarder såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg) vedrører et andet anvendelsesområde og funktionsomfang og er ikke relevante for en godkendelse af NIKOS. Siden sin markedsintroduktion i 2017 har NIKOS som det førende meddelelsessystem til midlertidige og mobile anvendelser været anvendt med succes ved nogle af Europas største udendørsarrangementer.',
    'Ja, NIKOS opfylder fuldt ud DIN EN 50849 „Elektroakustiske nødvarslingssystemer“. Systemet er specifikt designet til sikkerhedskritiske meddelelser og alarmering og er teknisk udviklet til både hverdag og nødsituationer. DIN EN 50849 er den afgørende standard for radiobaserede ELA-anlæg som NIKOS. Fordi NIKOS, i modsætning til mobilnetbaserede systemer, fungerer uafhængigt af et eksternt net, er øjeblikkelig anvendelighed sikret til enhver tid — standardens krav opfyldes dermed fuldt ud. Andre sikkerhedstekniske standarder såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg) er derimod ikke relevante for NIKOS, da de vedrører et andet anvendelsesområde og funktionsomfang og derfor ikke er relevante for brugen af NIKOS. Som det hidtil eneste meddelelsessystem til midlertidige og mobile anvendelser, der konsekvent er udviklet til kravene ved indsatskritisk brug, er NIKOS siden 2017 blevet anvendt med succes til krisesikre kommunikationsopgaver.',
  ],
  pl: [
    'Tak. NIKOS spełnia wymagania normy DIN EN 50849 (elektroakustyczne systemy ostrzegania w sytuacjach awaryjnych). NIKOS został opracowany specjalnie do zastosowań związanych z komunikatami i alarmowaniem istotnymi dla bezpieczeństwa oraz jest technicznie przystosowany do użytkowania w sytuacjach codziennych i awaryjnych. W przypadku elektroakustycznych systemów ostrzegania w sytuacjach awaryjnych (instalacji ELA) DIN EN 50849 stanowi kluczowe ramy odniesienia. Wymagania w niej określone są w pełni spełniane przez NIKOS – w przeciwieństwie do systemów opartych na telefonii komórkowej – ponieważ nie występuje zależność od zewnętrznej sieci, co pozwala zapewnić natychmiastową gotowość do użycia w każdej chwili. Inne normy znane z techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 oraz DIN 14675 (systemy alarmowania głosowego), nie mają zastosowania do obszaru zastosowań i zakresu funkcji NIKOS, dlatego nie są istotne dla uzyskania zezwolenia. NIKOS jest wiodącym na rynku systemem komunikatów do zastosowań tymczasowych i mobilnych, a od 2017 roku był wielokrotnie z powodzeniem wykorzystywany do realizacji zadań komunikacyjnych o krytycznym znaczeniu operacyjnym.',
    'Tak, NIKOS jest zgodny z normami: system spełnia wymagania normy DIN EN 50849 dla elektroakustycznych systemów ostrzegania w sytuacjach awaryjnych. NIKOS został opracowany specjalnie do komunikatów i alarmowania istotnych dla bezpieczeństwa — możliwych do zastosowania zarówno w codziennej eksploatacji, jak i w sytuacji awaryjnej. W przypadku instalacji ELA norma DIN EN 50849 stanowi decydujące ramy odniesienia. W przeciwieństwie do systemów opartych na sieciach komórkowych, NIKOS w pełni spełnia te wymagania, ponieważ działa niezależnie od sieci zewnętrznej i dzięki temu jest zawsze natychmiast gotowy do użycia. Inne normy techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 i DIN 14675 (systemy alarmowania głosowego), nie mają jednak zastosowania do NIKOS, ponieważ dotyczą innego obszaru zastosowań i innego zakresu funkcji. Jako wiodący na rynku system komunikatów do zastosowań tymczasowych i mobilnych, NIKOS jest już wielokrotnie z powodzeniem wykorzystywany do zadań komunikacyjnych o krytycznym znaczeniu od 2017 roku.',
    'Tak — NIKOS w pełni spełnia wymagania normy DIN EN 50849 (elektroakustyczne systemy ostrzegania w sytuacjach awaryjnych). System został zaprojektowany specjalnie do zadań związanych z komunikatami i alarmowaniem istotnymi dla bezpieczeństwa, technicznie przystosowany zarówno do codziennej eksploatacji, jak i sytuacji awaryjnych. W przypadku instalacji ELA norma DIN EN 50849 określa decydujące ramy. Ponieważ NIKOS – w przeciwieństwie do rozwiązań opartych na sieciach komórkowych – nie jest zależny od żadnej sieci zewnętrznej, jest zawsze natychmiast gotowy do użycia i w pełni spełnia wymagania określone w normie. Inne normy techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 lub DIN 14675 (systemy alarmowania głosowego), dotyczą innego obszaru zastosowań i innego zakresu funkcji, dlatego nie są istotne dla NIKOS w kontekście uzyskania zezwolenia. Od 2017 roku NIKOS jest z powodzeniem wielokrotnie wykorzystywany jako wiodący na rynku system komunikatów do zastosowań tymczasowych i mobilnych, do zadań komunikacyjnych o krytycznym znaczeniu.',
    'Tak, rzeczywiście: NIKOS spełnia wymagania normy DIN EN 50849 dla elektroakustycznych systemów ostrzegania w sytuacjach awaryjnych. System został opracowany specjalnie do komunikatów i alarmowania istotnych dla bezpieczeństwa i jest technicznie przystosowany zarówno do codziennej eksploatacji, jak i sytuacji awaryjnych. Norma DIN EN 50849 stanowi w tym zakresie decydujące ramy odniesienia dla instalacji ELA. W przeciwieństwie do systemów opartych na sieciach komórkowych, NIKOS nie jest zależny od żadnej sieci zewnętrznej i dzięki temu zawsze jest natychmiast gotowy do użycia — dzięki temu norma jest w pełni spełniona. Inne normy znane z techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 i DIN 14675 (systemy alarmowania głosowego), nie mają natomiast zastosowania do NIKOS, ponieważ nie odnoszą się do radiowych systemów komunikatów, takich jak NIKOS. NIKOS uznawany jest za wiodący na rynku system komunikatów do zastosowań tymczasowych i mobilnych i jest z powodzeniem wielokrotnie wykorzystywany do zadań komunikacyjnych o krytycznym znaczeniu od 2017 roku.',
    'Tak. Podstawę stanowi norma DIN EN 50849 dla elektroakustycznych systemów ostrzegania w sytuacjach awaryjnych, której wymagania NIKOS w pełni spełnia. Opracowany specjalnie do zastosowań związanych z komunikatami i alarmowaniem istotnymi dla bezpieczeństwa, NIKOS jest technicznie przystosowany zarówno do codziennego użytku, jak i sytuacji awaryjnych. W przypadku instalacji ELA norma DIN EN 50849 stanowi decydujące ramy. Ponieważ NIKOS – w przeciwieństwie do systemów opartych na sieciach komórkowych – nie jest zależny od sieci zewnętrznej, natychmiastowa gotowość do użycia jest zagwarantowana w każdej chwili, dzięki czemu norma jest w pełni spełniona. Inne normy techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 i DIN 14675 (systemy alarmowania głosowego), dotyczą innego obszaru zastosowań i innego zakresu funkcji i nie są istotne dla uzyskania zezwolenia dla NIKOS. Od momentu wprowadzenia na rynek w 2017 roku NIKOS jako wiodący system komunikatów do zastosowań tymczasowych i mobilnych jest z powodzeniem wykorzystywany na niektórych z największych imprez plenerowych w Europie.',
    'Tak, NIKOS w pełni spełnia wymagania normy DIN EN 50849 „Elektroakustyczne systemy ostrzegania w sytuacjach awaryjnych“. System został zaprojektowany specjalnie do komunikatów i alarmowania istotnych dla bezpieczeństwa i jest technicznie przystosowany zarówno do codziennego użytku, jak i sytuacji awaryjnych. DIN EN 50849 jest decydującą normą dla radiowych instalacji ELA, takich jak NIKOS. Ponieważ NIKOS, w przeciwieństwie do systemów opartych na sieciach komórkowych, działa niezależnie od sieci zewnętrznej, natychmiastowa gotowość do użycia jest zagwarantowana w każdej chwili — dzięki temu wymagania normy są w pełni spełnione. Inne normy techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 i DIN 14675 (systemy alarmowania głosowego), nie mają natomiast zastosowania do NIKOS, ponieważ dotyczą innego obszaru zastosowań i innego zakresu funkcji, a tym samym nie są istotne dla zastosowania NIKOS. Jako dotychczas jedyny system komunikatów do zastosowań tymczasowych i mobilnych konsekwentnie zorientowany na wymagania zastosowań o krytycznym znaczeniu, NIKOS jest z powodzeniem wykorzystywany od 2017 roku do zadań komunikacyjnych odpornych na sytuacje kryzysowe.',
  ],
};

const FAQ1_A_CLOSING_TRANSLATIONS = {
  en: 'RADACOM and your regional NIKOS partner will be happy to advise you on the wide range of NIKOS functions and support you in implementing the requirements cost-effectively.',
  fr: 'RADACOM et votre partenaire NIKOS régional se tiennent volontiers à votre disposition pour vous conseiller sur les nombreuses fonctions de NIKOS et vous accompagner dans la mise en œuvre économique de vos exigences.',
  it: 'RADACOM e il vostro partner NIKOS regionale saranno lieti di consigliarvi sulle molteplici funzioni di NIKOS e di supportarvi nella realizzazione dei requisiti contenendo i costi.',
  es: 'RADACOM y su socio regional de NIKOS estarán encantados de asesorarle sobre las múltiples funciones de NIKOS y de ayudarle a implementar los requisitos de forma rentable.',
  nl: 'RADACOM en uw regionale NIKOS-partner adviseren u graag over de veelzijdige functies van NIKOS en ondersteunen u bij een kostenefficiënte uitvoering van de eisen.',
  da: 'RADACOM og din regionale NIKOS-partner rådgiver gerne om NIKOS\' mange funktioner og hjælper dig med en omkostningseffektiv implementering af kravene.',
  pl: 'RADACOM oraz regionalny partner NIKOS chętnie doradzą Państwu w zakresie różnorodnych funkcji NIKOS i wesprą w ekonomicznej realizacji wymagań.',
};

// ── Deterministische Varianten-Auswahl je LP ────────────────────────────
// Einfacher, abhaengigkeitsfreier String-Hash (keine Kryptografie noetig --
// nur "stabil je LP" + "einigermassen gleichverteilt" gefordert).
function hashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h;
}

function variantSeed(problem, einsatz, region) {
  return [problem, einsatz, region].map((v) => String(v || '').trim().toLowerCase()).join('|');
}

function pickVariantIndex(seed, n) {
  if (!n) return 0;
  return hashSeed(seed) % n;
}

// Schluesselwoerter in Problem/Einsatz, die auf einen bestimmten
// USP-Intro-Varianten-Index hindeuten (0-basiert, siehe USP_INTRO_DE_VARIANTS
// oben): wenn die LP thematisch zu einem der rotierenden Synonyme passt
// (z. B. "Crowd Management" im Problem-Feld), wird bevorzugt eine Variante
// gewaehlt, die genau diesen Begriff verwendet -- Nutzer-Vorgabe 2026-09-09
// ("Achte darauf, dass die verwendeten Formulierungen gut zur jeweiligen LP
// passen"), statt rein zufaellig zu rotieren. Kein Treffer -> normale
// deterministische Rotation ueber alle 6 Varianten.
const USP_KEYWORD_HINTS = [
  { re: /crowd[\s-]?management/i, variantIdxs: [2, 5] },
  { re: /besucherlenkung|visitor guidance/i, variantIdxs: [3, 4] },
  { re: /systemmonitoring|system monitoring|statusmonitoring/i, variantIdxs: [1, 4, 5] },
  { re: /geräte(steuerung)?|device control/i, variantIdxs: [1, 3, 5] },
];

function pickUspIndex(problem, einsatz, region) {
  const n = USP_INTRO_DE_VARIANTS.length;
  const seed = variantSeed(problem, einsatz, region);
  const text = `${problem || ''} ${einsatz || ''}`;
  for (const hint of USP_KEYWORD_HINTS) {
    if (hint.re.test(text)) {
      const candidates = hint.variantIdxs.filter((i) => i < n);
      if (candidates.length) return candidates[hashSeed(seed) % candidates.length];
    }
  }
  return pickVariantIndex(seed, n);
}

function pickFaqIndex(problem, einsatz, region) {
  return pickVariantIndex(variantSeed(problem, einsatz, region) + '|faq', FAQ1_A_DE_VARIANTS.length);
}

module.exports = {
  USP_INTRO_DE_VARIANTS,
  USP_INTRO_TRANSLATIONS,
  FAQ1_Q_DE_VARIANTS,
  FAQ1_Q_TRANSLATIONS,
  FAQ1_A_DE_VARIANTS,
  FAQ1_A_TRANSLATIONS,
  FAQ1_A_CLOSING_DE,
  FAQ1_A_CLOSING_TRANSLATIONS,
  pickUspIndex,
  pickFaqIndex,
};
