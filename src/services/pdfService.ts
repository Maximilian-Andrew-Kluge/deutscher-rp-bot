import PDFDocument from 'pdfkit';
import type { VerfahrenRow } from './verfahrenService';
import type { NotizData } from '../utils/embeds';

// ── Farben (nach Vorlage: rot/weiß, seriös) ──────────────────────────────────
const C_RED        = '#a11c1c';   // Behörden-Rot (Header, Sektions-Nummern)
const C_HEADER_TXT = '#1a1a1a';   // Fast-Schwarz (Titel)
const C_BODY_TXT   = '#1a1a1a';   // Text
const C_LABEL      = '#666666';   // Feldbezeichnung
const C_BORDER     = '#cccccc';   // Rahmen
const C_LINE       = '#e0e0e0';   // Trennlinie
const C_FOOTER_TXT = '#888888';   // Footer
const C_SEAL       = '#8a1414';   // Dienstsiegel / Stempel
const C_SUBTLE     = '#999999';

// ── Maße ─────────────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;  // A4
const PAGE_H    = 841.89;
const MARGIN    = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SECTION_H = 20;
const FIELD_H   = 30;

const HINWEIS =
  'Diese Vorlage ist ausschließlich für das fiktive Roblox-Roleplay des Deutschen RP Servers bestimmt.\n' +
  'Keine echten personenbezogenen Daten oder realen Gerichtsverfahren eintragen.';

const FOOTER_TXT =
  'Fiktive Vorlage für das Roblox-Roleplay des Deutschen RP Servers — keine echten personenbezogenen Daten eintragen.';

// ── Gemeinsame Abschluss-Infos ────────────────────────────────────────────────
export interface AbschlussInfo {
  abgeschlossen: boolean;
  abgeschlossenVon?: string;
  abgeschlossenAm?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUSTIZAKTE (4 Seiten)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateJustizaktePDF(
  verfahren: VerfahrenRow & { urteil?: string; strafe?: string; abgeschlossen_am?: string; abgeschlossen_von_name?: string },
  notizen: NotizData[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      autoFirstPage: false,
      info: {
        Title: `Justizakte ${verfahren.aktenzeichen}`,
        Author: 'Deutscher RP Server',
        Subject: 'Justizakte',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const abgeschlossen = verfahren.status?.toLowerCase() === 'abgeschlossen';
    const gesamt = 4;

    // ── Seite 1: Stammdaten & Verfahren ──
    doc.addPage();
    drawPageHeader(doc, 'STAMMDATEN & VERFAHREN', 'Justizbehörde · Fiktives Rollenspiel-Dokument', `Formblatt Jus.-1 · Seite 1 von ${gesamt}`);
    let y = drawPageTitle(doc, 'JUSTIZAKTE', 'Stammdaten, Verfahrensstatus und Zuständigkeiten des Falls', 'J');

    y = drawSection(doc, y, '1', 'AKTENDATEN');
    y = drawFieldRow(doc, y, [
      { label: 'AKTENZEICHEN',   value: verfahren.aktenzeichen,            w: CONTENT_W * 0.35 },
      { label: 'ERSTELLT AM',    value: formatDate(verfahren.erstellt_am), w: CONTENT_W * 0.33 },
      { label: 'BEARBEITET VON', value: verfahren.erstellt_von,            w: CONTENT_W * 0.32 },
    ]);

    y = drawSection(doc, y + 6, '2', 'STATUS');
    y = drawCheckboxRow(doc, y, ['Offen', 'Ermittlung', 'Strafverfahren', 'Gerichtsverfahren', 'Abgeschlossen'], [statusToLabel(verfahren.status)]);

    y = drawSection(doc, y + 6, '3', 'PERSONENDATEN');
    y = drawFieldRow(doc, y, [
      { label: 'VOR- UND NACHNAME',     value: verfahren.beschuldigter || '', w: CONTENT_W * 0.55 },
      { label: 'ROBLOX-NAME (IN-GAME)', value: verfahren.roblox_name   || '', w: CONTENT_W * 0.45 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'ALTER / GEBURTSDATUM', value: verfahren.geburtsdatum || '', w: CONTENT_W * 0.33 },
      { label: 'FRAKTION',             value: verfahren.fraktion     || '', w: CONTENT_W * 0.34 },
      { label: 'ID',                   value: verfahren.roblox_id    || '', w: CONTENT_W * 0.33 },
    ]);

    y = drawSection(doc, y + 6, '4', 'VERFAHREN');
    y = drawFieldRow(doc, y, [
      { label: 'VERFAHRENSART',      value: verfahren.verfahrensart       || '', w: CONTENT_W * 0.5 },
      { label: 'ZUSTÄNDIGES GERICHT', value: verfahren.zustaendiges_gericht || '', w: CONTENT_W * 0.5 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'RICHTER',      value: verfahren.richter      || '', w: CONTENT_W * 0.33 },
      { label: 'STAATSANWALT', value: verfahren.staatsanwalt || '', w: CONTENT_W * 0.33 },
      { label: 'ANWALT',       value: verfahren.anwalt       || '', w: CONTENT_W * 0.34 },
    ]);
    doc.fontSize(8).fillColor(C_FOOTER_TXT).font('Helvetica-Oblique')
      .text('Die Tat, Beweise und Beteiligten werden auf den folgenden Seiten dokumentiert.', MARGIN, y + 6);

    // Aktenstempel-Box (Eingegangen / Geprüft)
    drawAktenstempel(doc, y + 30, verfahren.erstellt_am, verfahren.erstellt_von);

    // Behörden-Stempel oben rechts (Justiz)
    drawBehoerdenstempel(doc, 'JUSTIZ', abgeschlossen);
    drawPageFooter(doc, 1, gesamt);

    // ── Seite 2: Tat & Beweise ──
    doc.addPage();
    drawPageHeader(doc, 'TAT & BEWEISE', 'Justizbehörde · Fiktives Rollenspiel-Dokument', `Formblatt Jus.-2 · Seite 2 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'TAT / VORWURF');
    y = drawFieldRow(doc, y, [
      { label: 'TATZEIT', value: verfahren.tatzeit || '', w: CONTENT_W * 0.5 },
      { label: 'TATORT',  value: verfahren.tatort  || '', w: CONTENT_W * 0.5 },
    ]);
    const vorwurfText = [
      verfahren.vorwurf     ? `Vorwurf: ${verfahren.vorwurf}` : '',
      verfahren.sachverhalt ? `${verfahren.vorwurf ? '\n\n' : ''}Sachverhalt:\n${verfahren.sachverhalt}` : '',
    ].filter(Boolean).join('');
    y = drawBigField(doc, y, 'VORWURF / SACHVERHALT', vorwurfText, 150);

    y = drawSection(doc, y + 6, '2', 'BEWEISE');
    y = drawBigField(doc, y, 'BEWEISE / BESCHREIBUNG', verfahren.beweise || '', 150);

    drawPageFooter(doc, 2, gesamt);

    // ── Seite 3: Beteiligte & Notizen ──
    doc.addPage();
    drawPageHeader(doc, 'BETEILIGTE & NOTIZEN', 'Justizbehörde · Fiktives Rollenspiel-Dokument', `Formblatt Jus.-3 · Seite 3 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'BETEILIGTE');
    y = drawBigField(doc, y, 'ERMITTLER',         verfahren.ermittler                                   || '', FIELD_H);
    y = drawBigField(doc, y, 'GESCHÄDIGTER',      verfahren.geschaedigter                               || '', FIELD_H);
    y = drawBigField(doc, y, 'ZEUGE(N)',          verfahren.zeugen                                      || '', FIELD_H + 12);
    y = drawBigField(doc, y, 'WEITERE BETEILIGTE', verfahren.weitere_beteiligte || verfahren.zusatzinfo || '', FIELD_H);

    y = drawSection(doc, y + 6, '2', 'NOTIZEN');
    const notizText = notizen.length > 0
      ? notizen.map((n, i) => `${i + 1}. ${n.notiz} (${n.erstellt_von})`).join('\n')
      : '';
    y = drawBigField(doc, y, 'ZUSÄTZLICHE INFORMATIONEN', notizText, 120);

    drawPageFooter(doc, 3, gesamt);

    // ── Seite 4: Entscheidung & Abschluss ──
    doc.addPage();
    drawPageHeader(doc, 'ENTSCHEIDUNG & ABSCHLUSS', 'Justizbehörde · Fiktives Rollenspiel-Dokument', `Formblatt Jus.-4 · Seite 4 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'ENTSCHEIDUNG / URTEIL');
    y = drawBigField(doc, y, 'URTEIL / ENTSCHEIDUNG', verfahren.urteil || '', 90);
    y = drawBigField(doc, y, 'STRAFE / MASSNAHME',    verfahren.strafe || '', 90);

    y = drawSection(doc, y + 6, '2', 'ABSCHLUSS');
    y = drawFieldRow(doc, y, [
      { label: 'AKTE GESCHLOSSEN AM',  value: formatDate(verfahren.abgeschlossen_am), w: CONTENT_W * 0.55 },
      { label: 'ABGESCHLOSSEN DURCH', value: verfahren.abgeschlossen_von_name || '', w: CONTENT_W * 0.45 },
    ]);

    // Checkbox "Akte geprüft"
    drawSingleCheckbox(doc, MARGIN, y + 6, 'Akte geprüft und vollständig dokumentiert', abgeschlossen);
    y += 26;

    // Unterschrift + Dienstsiegel
    y = drawUnterschriftUndSiegel(doc, y, verfahren.abgeschlossen_von_name, verfahren.abgeschlossen_am, abgeschlossen);

    // Hinweis-Box
    drawHinweisBox(doc, y + 6);

    // Großer "ABGESCHLOSSEN"-Stempel diagonal über Seite 4
    if (abgeschlossen) drawAbgeschlossenStempel(doc, verfahren.abgeschlossen_am);

    drawPageFooter(doc, 4, gesamt);

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLIZEI-VERFAHRENSAKTE (6 Seiten)
// ═══════════════════════════════════════════════════════════════════════════════
export async function generatePolizeiaktePDF(
  verfahren: VerfahrenRow & { urteil?: string; strafe?: string; abgeschlossen_am?: string; abgeschlossen_von_name?: string },
  notizen: NotizData[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      autoFirstPage: false,
      info: {
        Title: `Polizei-Verfahrensakte ${verfahren.aktenzeichen}`,
        Author: 'Deutscher RP Server',
        Subject: 'Polizei-Verfahrensakte',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const abgeschlossen = verfahren.status?.toLowerCase() === 'abgeschlossen';
    const gesamt = 6;
    const sub = 'Polizeidirektion · Fiktives Rollenspiel-Dokument';

    // ── Seite 1: Deckblatt & Falldaten ──
    doc.addPage();
    drawPageHeader(doc, 'DECKBLATT & FALLDATEN', sub, `Formblatt Pol.-1 · Seite 1 von ${gesamt}`);
    let y = drawPageTitle(doc, 'POLIZEI-VERFAHRENSAKTE', 'Kombiniertes Formular für Anzeigenaufnahme, Ermittlung sowie Festnahme-/Einsatzprotokoll', 'P');

    y = drawSection(doc, y, '1', 'ART DES VORGANGS');
    y = drawCheckboxRow(doc, y, ['Anzeige', 'Ermittlungsverfahren', 'Festnahme', 'Einsatzprotokoll', 'Sonstiges'], [vorgangsart(verfahren.verfahrensart)]);

    y = drawSection(doc, y + 6, '2', 'FALLDATEN');
    y = drawFieldRow(doc, y, [
      { label: 'AKTENZEICHEN',              value: verfahren.aktenzeichen,            w: CONTENT_W * 0.5 },
      { label: 'DATUM / UHRZEIT DER AUFNAHME', value: formatDateTime(verfahren.erstellt_am), w: CONTENT_W * 0.5 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'SACHBEARBEITER (NAME, DIENSTGRAD)', value: verfahren.ermittler || verfahren.erstellt_von, w: CONTENT_W * 0.5 },
      { label: 'DIENSTNUMMER / BADGE-NR.',          value: '',                                            w: CONTENT_W * 0.5 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'ZUSTÄNDIGE DIENSTSTELLE / REVIER', value: verfahren.zustaendiges_gericht || '', w: CONTENT_W * 0.5 },
      { label: 'STATUS DES VERFAHRENS',            value: statusToLabel(verfahren.status),      w: CONTENT_W * 0.5 },
    ]);

    y = drawSection(doc, y + 6, '3', 'ORT UND ZEIT DES VORFALLS');
    y = drawFieldRow(doc, y, [
      { label: 'TATZEIT / ZEITRAUM', value: verfahren.tatzeit || '', w: CONTENT_W * 0.5 },
      { label: 'TATORT / ORT',       value: verfahren.tatort  || '', w: CONTENT_W * 0.5 },
    ]);

    y = drawSection(doc, y + 6, '4', 'KURZBESCHREIBUNG DES VORFALLS');
    y = drawBigField(doc, y, 'KURZFASSUNG (MAX. 2–3 SÄTZE)', verfahren.vorwurf || '', 60);

    drawAktenstempel(doc, y + 12, verfahren.erstellt_am, verfahren.erstellt_von);
    drawBehoerdenstempel(doc, 'POLIZEI', abgeschlossen);
    drawPageFooter(doc, 1, gesamt);

    // ── Seite 2: Beteiligte Personen ──
    doc.addPage();
    drawPageHeader(doc, 'BETEILIGTE PERSONEN', sub, `Formblatt Pol.-2 · Seite 2 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'BESCHULDIGTER / TATVERDÄCHTIGER');
    y = drawFieldRow(doc, y, [
      { label: 'ROBLOX-NAME (IN-GAME)', value: verfahren.roblox_name || verfahren.beschuldigter || '', w: CONTENT_W * 0.5 },
      { label: 'INTERNE RP-ID',         value: verfahren.roblox_id   || '',                            w: CONTENT_W * 0.5 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'BERUF / ROLLE IM RP', value: verfahren.fraktion || '', w: CONTENT_W * 0.5 },
      { label: 'VORSTRAFEN BEKANNT?',  value: '',                       w: CONTENT_W * 0.5 },
    ]);

    y = drawSection(doc, y + 6, '2', 'GESCHÄDIGTER / GEGENPARTEI');
    y = drawFieldRow(doc, y, [
      { label: 'ROBLOX-NAME (IN-GAME)', value: verfahren.geschaedigter || '', w: CONTENT_W * 0.5 },
      { label: 'INTERNE RP-ID',         value: '',                            w: CONTENT_W * 0.5 },
    ]);
    y = drawBigField(doc, y, 'KONTAKTANGABEN / ERREICHBARKEIT IM RP', '', FIELD_H);

    y = drawSection(doc, y + 6, '3', 'ZEUGEN');
    y = drawBigField(doc, y, 'ZEUGE(N) (NAME / ID)', verfahren.zeugen || '', FIELD_H + 20);

    y = drawSection(doc, y + 6, '4', 'ERMITTELNDE BEAMTE / WEITERE BETEILIGTE');
    y = drawFieldRow(doc, y, [
      { label: 'ERMITTLER (PERSON / EINHEIT)', value: verfahren.ermittler          || '', w: CONTENT_W * 0.5 },
      { label: 'WEITERE BETEILIGTE',           value: verfahren.weitere_beteiligte || '', w: CONTENT_W * 0.5 },
    ]);

    drawPageFooter(doc, 2, gesamt);

    // ── Seite 3: Vorwurf & Sachverhalt ──
    doc.addPage();
    drawPageHeader(doc, 'VORWURF & SACHVERHALT', sub, `Formblatt Pol.-3 · Seite 3 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'VORWURF / DELIKT');
    doc.fontSize(7).fillColor(C_LABEL).font('Helvetica')
      .text('Zutreffendes ankreuzen (Mehrfachauswahl möglich):', MARGIN, y);
    y += 12;
    const delikte = ['Diebstahl', 'Körperverletzung', 'Raub', 'Sachbeschädigung', 'Waffenbesitz', 'Fahren o. Führerschein', 'Betrug', 'Widerstand'];
    const aktiveDelikte = delikte.filter(d => (verfahren.vorwurf || '').toLowerCase().includes(d.toLowerCase().split(' ')[0]));
    y = drawCheckboxGrid(doc, y, delikte, aktiveDelikte, 4);
    y = drawBigField(doc, y + 2, 'SONSTIGER VORWURF', verfahren.vorwurf || '', 36);

    y = drawSection(doc, y + 6, '2', 'TATZEIT & TATORT (DETAIL)');
    y = drawFieldRow(doc, y, [
      { label: 'GENAUER TATZEITPUNKT', value: verfahren.tatzeit || '', w: CONTENT_W * 0.5 },
      { label: 'GENAUER TATORT',       value: verfahren.tatort  || '', w: CONTENT_W * 0.5 },
    ]);

    y = drawSection(doc, y + 6, '3', 'SACHVERHALT / CHRONOLOGIE');
    y = drawBigField(doc, y, 'SACHLICHE DARSTELLUNG DES GESCHEHENS', verfahren.sachverhalt || '', 200);

    drawPageFooter(doc, 3, gesamt);

    // ── Seite 4: Festnahme-/Einsatzprotokoll ──
    doc.addPage();
    drawPageHeader(doc, 'FESTNAHME- / EINSATZPROTOKOLL', sub, `Formblatt Pol.-4 · Seite 4 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'FESTNAHME');
    y = drawCheckboxRow(doc, y, ['Festnahme erfolgt', 'Keine Festnahme'], []);
    y = drawFieldRow(doc, y, [
      { label: 'ZEITPUNKT DER FESTNAHME', value: '', w: CONTENT_W * 0.5 },
      { label: 'ORT DER FESTNAHME',       value: '', w: CONTENT_W * 0.5 },
    ]);
    y = drawBigField(doc, y, 'EINGESETZTE BEAMTE (NAMEN / DIENSTNR.)', verfahren.ermittler || '', FIELD_H);

    y = drawSection(doc, y + 6, '2', 'ERGRIFFENE MASSNAHMEN');
    y = drawCheckboxRow(doc, y, ['Handschellen angelegt', 'Durchsuchung', 'Sicherstellung', 'Belehrung erfolgt'], []);
    y = drawBigField(doc, y, 'SICHERGESTELLTE GEGENSTÄNDE', '', FIELD_H + 10);

    y = drawSection(doc, y + 6, '3', 'WIDERSTAND & VERLETZUNGEN');
    y = drawCheckboxRow(doc, y, ['Widerstand geleistet', 'Kein Widerstand'], []);
    y = drawCheckboxRow(doc, y, ['Verletzungen aufgetreten', 'Keine Verletzungen'], []);
    y = drawBigField(doc, y, 'BESCHREIBUNG (WIDERSTAND / VERLETZUNGEN)', '', FIELD_H + 10);

    drawPageFooter(doc, 4, gesamt);

    // ── Seite 5: Beweise & Aussagen ──
    doc.addPage();
    drawPageHeader(doc, 'BEWEISE & AUSSAGEN', sub, `Formblatt Pol.-5 · Seite 5 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'BEWEISMITTEL / ANLAGEN');
    doc.fontSize(7).fillColor(C_LABEL).font('Helvetica').text('Zutreffendes ankreuzen:', MARGIN, y);
    y += 12;
    y = drawCheckboxRow(doc, y, ['Video', 'Screenshot', 'Zeugenaussage', 'Sonstiger Nachweis'], []);
    y = drawBigField(doc, y, 'BESCHREIBUNG DER BEWEISMITTEL', verfahren.beweise || '', 60);

    y = drawSection(doc, y + 6, '2', 'AUSSAGE DES BESCHULDIGTEN');
    y = drawBigField(doc, y, '', '', 90);

    y = drawSection(doc, y + 6, '3', 'AUSSAGE(N) DER ZEUGEN');
    y = drawBigField(doc, y, '', '', 90);

    drawPageFooter(doc, 5, gesamt);

    // ── Seite 6: Ergebnis & Abschluss ──
    doc.addPage();
    drawPageHeader(doc, 'ERGEBNIS & ABSCHLUSS', sub, `Formblatt Pol.-6 · Seite 6 von ${gesamt}`);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'ERGEBNIS DES VERFAHRENS');
    y = drawCheckboxRow(doc, y, ['Anklage erhoben', 'Verwarnung erteilt', 'Ohne Maßnahme eingestellt', 'An Gericht weitergeleitet'], []);
    y = drawBigField(doc, y, 'STRAFE / BUSSGELD / AUFLAGEN', verfahren.strafe || verfahren.urteil || '', 60);

    y = drawSection(doc, y + 6, '2', 'WEITERE SCHRITTE / FRISTEN');
    const notizPol = notizen.length > 0 ? notizen.map((n, i) => `${i + 1}. ${n.notiz} (${n.erstellt_von})`).join('\n') : '';
    y = drawBigField(doc, y, '', notizPol, 70);

    y = drawSection(doc, y + 6, '3', 'ABSCHLUSS');
    y = drawFieldRow(doc, y, [
      { label: 'ABGESCHLOSSEN AM',            value: formatDate(verfahren.abgeschlossen_am),   w: CONTENT_W * 0.5 },
      { label: 'ABGESCHLOSSEN DURCH (NAME / ROLLE)', value: verfahren.abgeschlossen_von_name || '', w: CONTENT_W * 0.5 },
    ]);
    y = drawBigField(doc, y, 'ABSCHLUSSVERMERK', verfahren.urteil || '', 40);

    y = drawUnterschriftUndSiegel(doc, y + 4, verfahren.abgeschlossen_von_name, verfahren.abgeschlossen_am, abgeschlossen);

    drawHinweisBox(doc, y + 6);

    if (abgeschlossen) drawAbgeschlossenStempel(doc, verfahren.abgeschlossen_am);

    drawPageFooter(doc, 6, gesamt);

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZEICHENFUNKTIONEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Kopfzeile oben auf jeder Seite (weiß mit rotem Akzent, wie Vorlage) */
function drawPageHeader(doc: PDFKit.PDFDocument, links: string, subtitel: string, rechts: string): void {
  const y = MARGIN;

  // Logo-Kreis (rot umrandet)
  doc.circle(MARGIN + 12, y + 12, 11).lineWidth(1.2).strokeColor(C_RED).stroke();
  doc.fontSize(11).fillColor(C_RED).font('Helvetica-Bold')
    .text(links.includes('Justiz') || subtitel.includes('Justiz') ? 'J' : 'P', MARGIN + 8, y + 6);

  // Titel + Untertitel links
  doc.fontSize(14).fillColor(C_HEADER_TXT).font('Helvetica-Bold')
    .text('DEUTSCHER RP SERVER', MARGIN + 30, y + 2);
  doc.fontSize(7.5).fillColor(C_LABEL).font('Helvetica-Oblique')
    .text(subtitel, MARGIN + 30, y + 18);

  // Rechts: Formblatt + Seite
  doc.fontSize(8.5).fillColor(C_HEADER_TXT).font('Helvetica-Bold')
    .text(links, MARGIN, y + 2, { width: CONTENT_W, align: 'right' });
  doc.fontSize(7.5).fillColor(C_LABEL).font('Helvetica')
    .text(rechts, MARGIN, y + 16, { width: CONTENT_W, align: 'right' });

  // Doppel-Trennlinie
  doc.moveTo(MARGIN, y + 32).lineTo(MARGIN + CONTENT_W, y + 32).lineWidth(1.5).strokeColor(C_HEADER_TXT).stroke();
  doc.moveTo(MARGIN, y + 35).lineTo(MARGIN + CONTENT_W, y + 35).lineWidth(0.5).strokeColor(C_HEADER_TXT).stroke();
}

/** Seitentitel + Untertitel (nur Seite 1) */
function drawPageTitle(doc: PDFKit.PDFDocument, titel: string, untertitel: string, _logo: string): number {
  const y = MARGIN + 48;
  doc.fontSize(19).fillColor(C_HEADER_TXT).font('Helvetica-Bold').text(titel, MARGIN, y);
  doc.fontSize(8).fillColor(C_LABEL).font('Helvetica').text(untertitel, MARGIN, y + 24, { width: CONTENT_W * 0.7 });
  return y + 44;
}

/** Sektions-Header (rote Nummer + Titel + rote Unterlinie, wie Vorlage) */
function drawSection(doc: PDFKit.PDFDocument, y: number, nr: string, titel: string): number {
  doc.fontSize(11).fillColor(C_RED).font('Helvetica-Bold').text(`§${nr}`, MARGIN, y);
  doc.fontSize(11).fillColor(C_HEADER_TXT).font('Helvetica-Bold').text(titel, MARGIN + 26, y);
  const ly = y + SECTION_H - 4;
  doc.moveTo(MARGIN, ly).lineTo(MARGIN + CONTENT_W, ly).lineWidth(1).strokeColor(C_HEADER_TXT).stroke();
  return ly + 8;
}

/** Eine Zeile mit mehreren Feldern nebeneinander (Unterstrich-Stil) */
function drawFieldRow(
  doc: PDFKit.PDFDocument,
  y: number,
  fields: Array<{ label: string; value: string; w: number }>
): number {
  let x = MARGIN;
  const h = FIELD_H;

  fields.forEach((f, i) => {
    const fw = f.w - (i < fields.length - 1 ? 12 : 0);

    doc.fontSize(6.5).fillColor(C_LABEL).font('Helvetica-Bold')
      .text(f.label.toUpperCase(), x, y, { width: fw });

    if (f.value) {
      doc.fontSize(9).fillColor(C_BODY_TXT).font('Helvetica')
        .text(f.value, x, y + 12, { width: fw, ellipsis: true, lineBreak: false });
    }

    // Unterstrich-Linie
    doc.moveTo(x, y + h - 4).lineTo(x + fw, y + h - 4).lineWidth(0.5).strokeColor(C_BORDER).stroke();

    x += f.w;
  });

  return y + h + 4;
}

/** Großes mehrzeiliges Feld (Rahmen-Box) */
function drawBigField(doc: PDFKit.PDFDocument, y: number, label: string, value: string, h: number): number {
  let top = y;
  if (label) {
    doc.fontSize(6.5).fillColor(C_LABEL).font('Helvetica-Bold').text(label.toUpperCase(), MARGIN, top);
    top += 10;
  }
  doc.rect(MARGIN, top, CONTENT_W, h).lineWidth(0.5).strokeColor(C_BORDER).stroke();

  if (value) {
    doc.fontSize(8.5).fillColor(C_BODY_TXT).font('Helvetica')
      .text(value, MARGIN + 6, top + 6, { width: CONTENT_W - 12, height: h - 10, ellipsis: true });
  }

  return top + h + 6;
}

/** Checkbox-Reihe (eine Zeile, gleichmäßig verteilt) */
function drawCheckboxRow(doc: PDFKit.PDFDocument, y: number, optionen: string[], aktiv: string[]): number {
  const boxW = CONTENT_W / optionen.length;
  const aktivLower = aktiv.map(a => a.toLowerCase());

  optionen.forEach((opt, i) => {
    const x = MARGIN + i * boxW;
    const checked = aktivLower.includes(opt.toLowerCase());
    drawCheckbox(doc, x, y, opt, checked, boxW - 6);
  });

  return y + 22;
}

/** Checkbox-Gitter (mehrere Spalten/Zeilen) */
function drawCheckboxGrid(doc: PDFKit.PDFDocument, y: number, optionen: string[], aktiv: string[], cols: number): number {
  const boxW = CONTENT_W / cols;
  const aktivLower = aktiv.map(a => a.toLowerCase());
  let row = 0;

  optionen.forEach((opt, i) => {
    const col = i % cols;
    row = Math.floor(i / cols);
    const x = MARGIN + col * boxW;
    const cy = y + row * 18;
    const checked = aktivLower.includes(opt.toLowerCase());
    drawCheckbox(doc, x, cy, opt, checked, boxW - 6);
  });

  return y + (row + 1) * 18 + 4;
}

/** Einzelne Checkbox */
function drawCheckbox(doc: PDFKit.PDFDocument, x: number, y: number, label: string, checked: boolean, w: number): void {
  doc.rect(x, y, 9, 9).lineWidth(0.7).strokeColor(checked ? C_RED : C_BORDER).stroke();
  if (checked) {
    // Häkchen
    doc.moveTo(x + 1.8, y + 4.8).lineTo(x + 3.6, y + 6.8).lineTo(x + 7.2, y + 2).lineWidth(1.2).strokeColor(C_RED).stroke();
  }
  doc.fontSize(8).fillColor(C_BODY_TXT).font(checked ? 'Helvetica-Bold' : 'Helvetica')
    .text(label, x + 13, y + 1, { width: w - 13, ellipsis: true, lineBreak: false });
}

/** Einzelne freistehende Checkbox mit Label */
function drawSingleCheckbox(doc: PDFKit.PDFDocument, x: number, y: number, label: string, checked: boolean): void {
  drawCheckbox(doc, x, y, label, checked, CONTENT_W - 20);
}

/** Aktenstempel-Box (Eingegangen am / Geprüft durch) */
function drawAktenstempel(doc: PDFKit.PDFDocument, y: number, eingegangen?: string | null, geprueft?: string): void {
  const boxW = 220;
  const boxH = 60;
  // gestrichelter Rahmen
  doc.save();
  doc.dash(2, { space: 2 }).rect(MARGIN, y, boxW, boxH).lineWidth(0.7).strokeColor(C_RED).stroke();
  doc.undash();
  doc.restore();

  doc.fontSize(8).fillColor(C_RED).font('Helvetica-Bold').text('AKTENSTEMPEL', MARGIN + 8, y + 6);
  doc.fontSize(7.5).fillColor(C_BODY_TXT).font('Helvetica')
    .text(`Eingegangen am: ${formatDate(eingegangen)}`, MARGIN + 8, y + 22);
  doc.text(`Geprüft durch: ${geprueft || ''}`, MARGIN + 8, y + 40);
}

/** Behörden-Rundstempel oben rechts (JUSTIZ/POLIZEI) */
function drawBehoerdenstempel(doc: PDFKit.PDFDocument, text: string, abgeschlossen: boolean): void {
  const cx = MARGIN + CONTENT_W - 42;
  const cy = MARGIN + 78;
  const color = abgeschlossen ? C_SEAL : C_SUBTLE;
  doc.save();
  doc.lineWidth(1.5).strokeColor(color);
  doc.circle(cx, cy, 34).stroke();
  doc.lineWidth(0.7).circle(cx, cy, 28).stroke();
  doc.fontSize(6).fillColor(color).font('Helvetica-Bold');
  drawCircularText(doc, 'DEUTSCHER RP SERVER', cx, cy, 31, -90);
  doc.fontSize(11).fillColor(color).font('Helvetica-Bold')
    .text(text, cx - 30, cy - 6, { width: 60, align: 'center' });
  doc.restore();
}

/** Text kreisförmig anordnen (obere Hälfte) */
function drawCircularText(doc: PDFKit.PDFDocument, text: string, cx: number, cy: number, r: number, startDeg: number): void {
  const chars = text.split('');
  const totalDeg = 180;
  const step = totalDeg / Math.max(chars.length, 1);
  chars.forEach((ch, i) => {
    const deg = startDeg - totalDeg / 2 + step * i + step / 2;
    const rad = (deg * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    doc.save();
    doc.translate(x, y);
    doc.rotate(deg + 90);
    doc.text(ch, -3, -3, { lineBreak: false });
    doc.restore();
  });
}

/** Unterschrift-Zeilen + Dienstsiegel rechts */
function drawUnterschriftUndSiegel(
  doc: PDFKit.PDFDocument, y: number, name?: string, datum?: string | null, abgeschlossen?: boolean
): number {
  const top = y + 4;

  doc.fontSize(7).fillColor(C_LABEL).font('Helvetica-Bold')
    .text('UNTERSCHRIFT SACHBEARBEITER', MARGIN, top)
    .text('DATUM', MARGIN + CONTENT_W * 0.45, top);

  // gefüllte Werte, wenn abgeschlossen
  if (abgeschlossen && name) {
    doc.fontSize(11).fillColor(C_SEAL).font('Helvetica-Oblique')
      .text(name, MARGIN, top + 10, { width: CONTENT_W * 0.4 });
  }
  if (abgeschlossen && datum) {
    doc.fontSize(9).fillColor(C_BODY_TXT).font('Helvetica')
      .text(formatDate(datum), MARGIN + CONTENT_W * 0.45, top + 12);
  }

  const ly = top + 26;
  doc.moveTo(MARGIN, ly).lineTo(MARGIN + CONTENT_W * 0.4, ly).lineWidth(0.5).strokeColor(C_BODY_TXT).stroke();
  doc.moveTo(MARGIN + CONTENT_W * 0.45, ly).lineTo(MARGIN + CONTENT_W * 0.65, ly).lineWidth(0.5).strokeColor(C_BODY_TXT).stroke();

  // Dienstsiegel-Kreis rechts
  const cx = MARGIN + CONTENT_W - 40;
  const cy = top + 6;
  if (abgeschlossen) {
    doc.save();
    doc.lineWidth(1.3).strokeColor(C_SEAL);
    doc.circle(cx, cy, 32).stroke();
    doc.lineWidth(0.6).circle(cx, cy, 26).stroke();
    doc.fontSize(5.5).fillColor(C_SEAL).font('Helvetica-Bold');
    drawCircularText(doc, 'DEUTSCHER RP SERVER · DIENSTSIEGEL', cx, cy, 29, -90);
    doc.fontSize(9).fillColor(C_SEAL).font('Helvetica-Bold')
      .text('AMTLICH', cx - 26, cy - 4, { width: 52, align: 'center' });
    doc.restore();
  } else {
    doc.save();
    doc.dash(2, { space: 2 }).lineWidth(0.7).strokeColor(C_SUBTLE);
    doc.circle(cx, cy, 30).stroke();
    doc.undash();
    doc.fontSize(6.5).fillColor(C_SUBTLE).font('Helvetica')
      .text('Raum für\nDienstsiegel', cx - 28, cy - 8, { width: 56, align: 'center' });
    doc.restore();
  }

  return ly + 16;
}

/** Großer diagonaler "ABGESCHLOSSEN"-Stempel */
function drawAbgeschlossenStempel(doc: PDFKit.PDFDocument, datum?: string | null): void {
  const cx = PAGE_W / 2 + 60;
  const cy = PAGE_H / 2 + 40;

  doc.save();
  doc.translate(cx, cy);
  doc.rotate(-18);
  doc.opacity(0.55);

  const w = 260;
  const h = 66;
  doc.lineWidth(3).strokeColor(C_SEAL);
  doc.roundedRect(-w / 2, -h / 2, w, h, 8).stroke();
  doc.lineWidth(1).roundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 5).stroke();

  doc.fontSize(30).fillColor(C_SEAL).font('Helvetica-Bold')
    .text('ABGESCHLOSSEN', -w / 2, -18, { width: w, align: 'center' });
  if (datum) {
    doc.fontSize(9).font('Helvetica-Bold')
      .text(formatDate(datum), -w / 2, 16, { width: w, align: 'center' });
  }

  doc.opacity(1);
  doc.restore();
}

/** Hinweis-Box unten */
function drawHinweisBox(doc: PDFKit.PDFDocument, y: number): void {
  const h = 42;
  doc.rect(MARGIN, y, CONTENT_W, h).fillColor('#f5f5f5').fill();
  doc.rect(MARGIN, y, 3, h).fillColor(C_RED).fill();
  doc.fontSize(8).fillColor(C_RED).font('Helvetica-Bold').text('HINWEIS', MARGIN + 10, y + 6);
  doc.font('Helvetica').fontSize(7.5).fillColor(C_BODY_TXT)
    .text(HINWEIS, MARGIN + 10, y + 18, { width: CONTENT_W - 20 });
}

/** Fußzeile */
function drawPageFooter(doc: PDFKit.PDFDocument, seite: number, gesamt: number): void {
  const y = PAGE_H - MARGIN - 18;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(0.5).strokeColor(C_LINE).stroke();
  doc.fontSize(6.5).fillColor(C_FOOTER_TXT).font('Helvetica-Oblique')
    .text(FOOTER_TXT, MARGIN, y + 4, { width: CONTENT_W - 60 })
    .text(`Seite ${seite}/${gesamt}`, MARGIN, y + 4, { width: CONTENT_W, align: 'right' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════════════════════════

function statusToLabel(status?: string): string {
  const map: Record<string, string> = {
    offen: 'Offen', ermittlung: 'Ermittlung', strafverfahren: 'Strafverfahren',
    gerichtsverfahren: 'Gerichtsverfahren', abgeschlossen: 'Abgeschlossen',
  };
  return map[status?.toLowerCase() ?? ''] || 'Offen';
}

function vorgangsart(art?: string): string {
  const a = (art || '').toLowerCase();
  if (a.includes('anzeige')) return 'Anzeige';
  if (a.includes('festnahme')) return 'Festnahme';
  if (a.includes('einsatz')) return 'Einsatzprotokoll';
  if (a.includes('ermittl')) return 'Ermittlungsverfahren';
  return 'Ermittlungsverfahren';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
