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
 * — NICHT eine der lib/nodes/*.js-Pseudo-n8n-Code-Node-Dateien.
 *
 * EINTRAG 1: usp_intro. Der deutsche Ausgangssatz ist in index.js als
 * FIXED_USP_INTRO_DE hart hinterlegt und ändert sich NIE zwischen
 * Kombinationen (reiner Marken-/Plattform-Satz, unabhängig vom konkreten
 * Einsatz/Region). Die folgenden Übersetzungen wurden am 2026-09-03 mit
 * gpt-5.6-terra erzeugt (siehe Vergleich_Terra_vs_Luna_2026-09-03.md) und
 * stichprobenartig geprüft/freigegeben.
 *
 * WICHTIG bei einer inhaltlichen Änderung von FIXED_USP_INTRO_DE
 * (site/automation/lp-generator/index.js): diese Übersetzungen müssen dann
 * neu erzeugt und hier ersetzt werden, sonst weichen sie vom neuen
 * deutschen Satz ab.
 *
 * EINTRAG 2: faq1_q / faq1_a (Normkonformität, DIN EN 50849). Deutscher
 * Ausgangstext = kanonische Fassung aus
 * site/nikos/LANDINGPAGES_Textbausteine.md (dort ausdrücklich als
 * 'WORTGENAU verwenden — compliance-relevant' markiert, ohne
 * seitenspezifische Platzhalter). In index.js als FIXED_FAQ1_Q_DE /
 * FIXED_FAQ1_A_DE hart hinterlegt. Grund für die Übernahme in die
 * Textbausteine-Liste (Nutzer-Vorgabe 2026-09-03): bei der freien
 * KI-Generierung wurde beobachtet, dass diese compliance-relevante Antwort
 * trotz der WORTGENAU-Anweisung im Prompt nicht zuverlässig wortgleich
 * reproduziert wird (Abweichungen bei Wortwahl/Satzbau gegenüber der
 * freigegebenen Fassung) -- durch das Einfrieren von Quelltext UND
 * Übersetzungen ist die inhaltlich und rechtlich wichtige Normaussage auf
 * jeder Seite garantiert identisch, unabhängig vom Modell. Übersetzungen
 * erzeugt am 2026-09-03 mit gpt-5.6-terra (0 Probleme im automatischen
 * mini_check.js für alle 7 Sprachen; kein 'GmbH' bei RADACOM; DIN-Normen
 * korrekt übernommen), geprüft/freigegeben.
 *
 * WICHTIG bei einer inhaltlichen Änderung von FIXED_FAQ1_Q_DE/
 * FIXED_FAQ1_A_DE (z. B. weil sich die Normlage ändert): diese
 * Übersetzungen müssen dann neu erzeugt und hier ersetzt werden.
 *
 * Fehlt eine Sprache in einer der folgenden Listen (z. B. weil die
 * Baseline später erweitert wird), fällt index.js automatisch auf die
 * frische Modell-Übersetzung für das jeweilige Feld zurück — kein
 * Codepfad bricht dadurch.
 */

const USP_INTRO_TRANSLATIONS = {
  en: "NIKOS combines announcements, alerting, visitor information and control in a single, network-independent platform.",
  fr: "NIKOS réunit les annonces, l’alerte, l’information des visiteurs et le pilotage au sein d’une plateforme unique, indépendante des réseaux.",
  it: "NIKOS riunisce annunci, allertamento, informazione dei visitatori e controllo in un'unica piattaforma indipendente dalla rete.",
  es: "NIKOS reúne avisos, alarmas, información para visitantes y control en una única plataforma independiente de la red.",
  nl: "NIKOS bundelt omroepberichten, alarmering, bezoekersinformatie en besturing in één enkel, netonafhankelijk platform.",
  da: "NIKOS samler meddelelser, alarmering, besøgsinformation og styring i én samlet, netuafhængig platform.",
  pl: "NIKOS łączy komunikaty, alarmowanie, informowanie uczestników i sterowanie w jednej, niezależnej od sieci platformie.",
};

const FAQ1_Q_TRANSLATIONS = {
  en: "Do announcements made with NIKOS comply with the applicable standards?",
  fr: "Les annonces diffusées avec NIKOS sont-elles conformes aux normes en vigueur ?",
  it: "Gli annunci effettuati con NIKOS sono conformi alle norme vigenti?",
  es: "¿Los avisos emitidos con NIKOS cumplen las normas vigentes?",
  nl: "Voldoen omroepberichten met NIKOS aan de geldende normen?",
  da: "Opfylder meddelelser med NIKOS de gældende standarder?",
  pl: "Czy komunikaty nadawane za pomocą NIKOS są zgodne z obowiązującymi normami?",
};

const FAQ1_A_TRANSLATIONS = {
  en: "Yes. NIKOS meets the requirements of DIN EN 50849 (electroacoustic emergency warning systems). NIKOS was developed specifically for safety-relevant public address and alerting applications and is technically designed for use in both everyday and emergency situations. For electroacoustic emergency warning systems, DIN EN 50849 is the relevant reference framework. Unlike mobile network-based systems, NIKOS fully meets the requirements specified therein, as it does not depend on an external network and can therefore be used immediately at any time. Other standards known from safety technology, such as DIN EN 54, DIN VDE 0833-4 and DIN 14675 (voice alarm systems), do not apply to the field of use and functional scope of NIKOS and are therefore not relevant for approval. NIKOS is the market-leading public address system for temporary and mobile applications and has been successfully deployed in numerous mission-critical communication tasks since 2017. RADACOM and your regional NIKOS partner will be happy to advise you on the wide range of NIKOS functions and support you in implementing the requirements cost-effectively.",
  fr: "Oui. NIKOS satisfait aux exigences de la norme DIN EN 50849 (systèmes électroacoustiques d’alerte d’urgence). NIKOS a été spécialement développé pour les applications d’annonces et d’alerte liées à la sécurité, et est techniquement conçu pour une utilisation dans des situations courantes comme dans des situations d’urgence. Pour les systèmes électroacoustiques d’alerte d’urgence (installations ELA), la norme DIN EN 50849 constitue le cadre de référence déterminant. Contrairement aux systèmes reposant sur les réseaux mobiles, NIKOS répond intégralement aux exigences qui y sont mentionnées, car il ne dépend d’aucun réseau tiers et peut ainsi garantir une disponibilité immédiate à tout moment. D’autres normes connues dans le domaine de la sécurité, telles que DIN EN 54, DIN VDE 0833-4 et DIN 14675 (systèmes d’alarme vocale), ne sont pas applicables au domaine d’utilisation ni au périmètre fonctionnel de NIKOS et ne sont donc pas pertinentes pour une autorisation. NIKOS est le système d’annonces leader du marché pour les applications temporaires et mobiles, et est utilisé avec succès depuis 2017 pour la mise en œuvre de nombreuses missions de communication critiques. RADACOM et votre partenaire NIKOS régional se tiennent volontiers à votre disposition pour vous conseiller sur les nombreuses fonctions de NIKOS et vous accompagner dans la mise en œuvre économique de vos exigences.",
  it: "Sì. NIKOS soddisfa i requisiti della DIN EN 50849 (sistemi elettroacustici di allarme di emergenza). NIKOS è stato sviluppato specificamente per applicazioni di annunci e allertamento rilevanti per la sicurezza ed è tecnicamente progettato per l'impiego in situazioni ordinarie e di emergenza. Per i sistemi elettroacustici di allarme di emergenza (impianti ELA), la DIN EN 50849 costituisce il principale quadro di riferimento. I requisiti ivi indicati sono pienamente soddisfatti da NIKOS, a differenza dei sistemi basati sulla telefonia mobile, poiché non vi è alcuna dipendenza da una rete esterna e può quindi essere garantita l'utilizzabilità immediata in qualsiasi momento. Altre norme note nell'ambito della tecnologia di sicurezza, quali DIN EN 54, DIN VDE 0833-4 e DIN 14675 (impianti di allarme vocale), non sono applicabili al campo d'impiego e alla gamma di funzioni di NIKOS e non sono pertanto rilevanti ai fini dell'autorizzazione. NIKOS è il sistema di diffusione sonora leader di mercato per applicazioni temporanee e mobili e dal 2017 viene impiegato con successo in numerose occasioni per realizzare compiti di comunicazione critici per le operazioni. RADACOM e il vostro partner NIKOS regionale saranno lieti di consigliarvi sulle molteplici funzioni di NIKOS e di supportarvi nella realizzazione dei requisiti contenendo i costi.",
  es: "Sí. NIKOS cumple los requisitos de la DIN EN 50849 (sistemas electroacústicos de alerta de emergencia). NIKOS se ha desarrollado específicamente para aplicaciones de avisos y alertas relevantes para la seguridad y está diseñado técnicamente para su uso en situaciones cotidianas y de emergencia. Para los sistemas electroacústicos de alerta de emergencia (instalaciones ELA), la DIN EN 50849 constituye el marco de referencia determinante. A diferencia de los sistemas basados en redes móviles, NIKOS cumple íntegramente los requisitos indicados en esta norma, ya que no depende de una red externa y, por tanto, puede garantizarse su disponibilidad inmediata en todo momento. Otras normas conocidas en el ámbito de la tecnología de seguridad, como DIN EN 54, DIN VDE 0833-4 y DIN 14675 (sistemas de alarma por voz), no son aplicables al ámbito de uso ni al espectro funcional de NIKOS y, por lo tanto, no son relevantes a efectos de autorización. NIKOS es el sistema de megafonía líder del mercado para aplicaciones temporales y móviles, y desde 2017 se utiliza con éxito en numerosas ocasiones para llevar a cabo tareas de comunicación críticas para la operación. RADACOM y su socio regional de NIKOS estarán encantados de asesorarle sobre las múltiples funciones de NIKOS y de ayudarle a implementar los requisitos de forma rentable.",
  nl: "Ja. NIKOS voldoet aan de eisen van DIN EN 50849 (elektro-akoestische noodwaarschuwingssystemen). NIKOS is speciaal ontwikkeld voor veiligheidsrelevante omroep- en alarmeringstoepassingen en technisch ontworpen voor gebruik in alledaagse en noodsituaties. Voor elektro-akoestische noodwaarschuwingssystemen (ELA-installaties) is DIN EN 50849 het bepalende referentiekader. De daarin genoemde eisen worden door NIKOS – in tegenstelling tot systemen op basis van mobiele netwerken – volledig vervuld, omdat er geen afhankelijkheid van een extern netwerk bestaat en daardoor te allen tijde onmiddellijk gebruik kan worden gegarandeerd. Andere uit de veiligheidstechniek bekende normen, zoals DIN EN 54, DIN VDE 0833-4 en DIN 14675 (spraakalarminstallaties), zijn niet van toepassing op het toepassingsgebied en het functiespectrum van NIKOS en daarom niet relevant voor een vergunning. NIKOS is het marktleidende omroepsysteem voor tijdelijke en mobiele toepassingen en wordt sinds 2017 vele malen met succes ingezet voor de uitvoering van inzetkritische communicatietaken. RADACOM en uw regionale NIKOS-partner adviseren u graag over de veelzijdige functies van NIKOS en ondersteunen u bij een kostenefficiënte uitvoering van de eisen.",
  da: "Ja. NIKOS opfylder kravene i DIN EN 50849 (elektroakustiske nødvarslingssystemer). NIKOS er udviklet specifikt til sikkerhedskritiske meddelelses- og alarmeringsanvendelser og er teknisk designet til brug i både hverdags- og nødsituationer. For elektroakustiske nødvarslingssystemer (ELA-anlæg) er DIN EN 50849 den afgørende referenceramme. Kravene heri opfyldes fuldt ud af NIKOS – i modsætning til mobilnetbaserede systemer – da der ikke er afhængighed af et eksternt net, og øjeblikkelig anvendelighed dermed kan sikres til enhver tid. Andre standarder, der kendes fra sikkerhedsteknikken, såsom DIN EN 54, DIN VDE 0833-4 og DIN 14675 (talevarslingsanlæg), er ikke anvendelige på NIKOS' anvendelsesområde og funktionsomfang og er derfor ikke relevante for en godkendelse. NIKOS er det markedsførende meddelelsessystem til midlertidige og mobile anvendelser og har siden 2017 været anvendt med succes til udførelse af indsatskritiske kommunikationsopgaver. RADACOM og din regionale NIKOS-partner rådgiver gerne om NIKOS' mange funktioner og hjælper dig med en omkostningseffektiv implementering af kravene.",
  pl: "Tak. NIKOS spełnia wymagania normy DIN EN 50849 (elektroakustyczne systemy ostrzegania w sytuacjach awaryjnych). NIKOS został opracowany specjalnie do zastosowań związanych z komunikatami i alarmowaniem istotnymi dla bezpieczeństwa oraz jest technicznie przystosowany do użytkowania w sytuacjach codziennych i awaryjnych. W przypadku elektroakustycznych systemów ostrzegania w sytuacjach awaryjnych (instalacji ELA) DIN EN 50849 stanowi kluczowe ramy odniesienia. Wymagania w niej określone są w pełni spełniane przez NIKOS – w przeciwieństwie do systemów opartych na telefonii komórkowej – ponieważ nie występuje zależność od zewnętrznej sieci, co pozwala zapewnić natychmiastową gotowość do użycia w każdej chwili. Inne normy znane z techniki bezpieczeństwa, takie jak DIN EN 54, DIN VDE 0833-4 oraz DIN 14675 (systemy alarmowania głosowego), nie mają zastosowania do obszaru zastosowań i zakresu funkcji NIKOS, dlatego nie są istotne dla uzyskania zezwolenia. NIKOS jest wiodącym na rynku systemem komunikatów do zastosowań tymczasowych i mobilnych, a od 2017 roku był wielokrotnie z powodzeniem wykorzystywany do realizacji zadań komunikacyjnych o krytycznym znaczeniu operacyjnym. RADACOM oraz regionalny partner NIKOS chętnie doradzą Państwu w zakresie różnorodnych funkcji NIKOS i wesprą w ekonomicznej realizacji wymagań.",
};

module.exports = { USP_INTRO_TRANSLATIONS, FAQ1_Q_TRANSLATIONS, FAQ1_A_TRANSLATIONS };
