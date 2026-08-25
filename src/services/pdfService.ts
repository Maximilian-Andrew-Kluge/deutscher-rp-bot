import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import type { VerfahrenRow } from './verfahrenService';
import type { NotizData } from '../utils/embeds';

// ── Farben (nach Vorlage) ────────────────────────────────────────────────────
const C_HEADER_BG  = '#0d1a2e';   // Dunkelblau Header
const C_HEADER_TXT = '#ffffff';   // Weiß
const C_GOLD       = '#c8a028';   // Gold (Akzente, Sektions-Nummern)
const C_SECTION_BG = '#0d1a2e';   // Dunkelblau Sektions-Header
const C_BODY_TXT   = '#1a1a1a';   // Dunkelgrau Text
const C_LABEL      = '#666666';   // Hellgrau Feldbezeichnung
const C_BORDER     = '#cccccc';   // Grau Rahmen
const C_LINE       = '#e0e0e0';   // Hell Trennlinie
const C_FOOTER_TXT = '#888888';   // Grau Footer
const C_WHITE      = '#ffffff';

// ── Maße ─────────────────────────────────────────────────────────────────────
const PAGE_W    = 595.28;  // A4
const PAGE_H    = 841.89;
const MARGIN    = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SECTION_H = 22;
const FIELD_H   = 32;
const FIELD_BIG = 80;

// ── Haupt-Export ──────────────────────────────────────────────────────────────
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

    // ── Seite 1: Stammdaten & Verfahren ──
    doc.addPage();
    drawPageHeader(doc, 'STAMMDATEN & VERFAHREN', 'J', 1, 4);
    let y = drawPageTitle(doc, 'JUSTIZAKTE', 'Stammdaten, Verfahrensstatus und Zuständigkeiten des Falls');

    // Sektion 1: Aktendaten
    y = drawSection(doc, y, '1', 'AKTENDATEN');
    y = drawFieldRow(doc, y, [
      { label: 'AKTENZEICHEN',   value: verfahren.aktenzeichen,          w: CONTENT_W * 0.35 },
      { label: 'ERSTELLT AM',    value: formatDate(verfahren.erstellt_am), w: CONTENT_W * 0.33 },
      { label: 'BEARBEITET VON', value: verfahren.erstellt_von,           w: CONTENT_W * 0.32 },
    ]);

    // Sektion 2: Status
    y = drawSection(doc, y + 8, '2', 'STATUS');
    y = drawStatusCheckboxes(doc, y, verfahren.status);

    // Sektion 3: Personendaten
    y = drawSection(doc, y + 8, '3', 'PERSONENDATEN');
    y = drawFieldRow(doc, y, [
      { label: 'VOR- UND NACHNAME',      value: verfahren.beschuldigter || '', w: CONTENT_W * 0.55 },
      { label: 'ROBLOX-NAME (IN-GAME)',  value: verfahren.roblox_name   || '', w: CONTENT_W * 0.45 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'ALTER / GEBURTSDATUM', value: verfahren.geburtsdatum    || '', w: CONTENT_W * 0.3 },
      { label: 'FRAKTION',             value: verfahren.fraktion        || '', w: CONTENT_W * 0.4 },
      { label: 'ID',                   value: verfahren.roblox_id       || '', w: CONTENT_W * 0.3 },
    ]);

    // Sektion 4: Verfahren
    y = drawSection(doc, y + 8, '4', 'VERFAHREN');
    y = drawFieldRow(doc, y, [
      { label: 'VERFAHRENSART',       value: verfahren.verfahrensart          || '', w: CONTENT_W * 0.55 },
      { label: 'ZUSTÄNDIGES GERICHT', value: verfahren.zustaendiges_gericht   || '', w: CONTENT_W * 0.45 },
    ]);
    y = drawFieldRow(doc, y, [
      { label: 'RICHTER',       value: verfahren.richter       || '', w: CONTENT_W * 0.33 },
      { label: 'STAATSANWALT',  value: verfahren.staatsanwalt  || '', w: CONTENT_W * 0.33 },
      { label: 'ANWALT',        value: verfahren.anwalt        || '', w: CONTENT_W * 0.34 },
    ]);
    doc.fontSize(8).fillColor(C_FOOTER_TXT).font('Helvetica-Oblique')
      .text('Die Tat, Beweise und Beteiligten werden auf den folgenden Seiten dokumentiert.', MARGIN, y + 8);

    drawPageFooter(doc, 1, 4);

    // ── Seite 2: Tat & Beweise ──
    doc.addPage();
    drawPageHeader(doc, 'TAT & BEWEISE', 'J', 2, 4);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'TAT / VORWURF');
    y = drawFieldRow(doc, y, [
      { label: 'TATZEIT', value: verfahren.tatzeit || '', w: CONTENT_W * 0.55 },
      { label: 'TATORT',  value: verfahren.tatort  || '', w: CONTENT_W * 0.45 },
    ]);
    // Vorwurf + Sachverhalt zusammen anzeigen
    const vorwurfText = [
      verfahren.vorwurf   ? `Vorwurf: ${verfahren.vorwurf}`         : '',
      verfahren.sachverhalt ? `\nSachverhalt:\n${verfahren.sachverhalt}` : '',
    ].filter(Boolean).join('');
    y = drawBigField(doc, y, 'VORWURF / SACHVERHALT', vorwurfText, 120);

    y = drawSection(doc, y + 8, '2', 'BEWEISE');
    y = drawBigField(doc, y, 'BEWEISE / BESCHREIBUNG', verfahren.beweise || '', 110);

    drawPageFooter(doc, 2, 4);

    // ── Seite 3: Beteiligte & Notizen ──
    doc.addPage();
    drawPageHeader(doc, 'BETEILIGTE & NOTIZEN', 'J', 3, 4);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'BETEILIGTE');
    y = drawBigField(doc, y, 'ERMITTLER',           verfahren.ermittler         || '', FIELD_H);
    y = drawBigField(doc, y, 'GESCHÄDIGTER',         verfahren.geschaedigter     || '', FIELD_H);
    y = drawBigField(doc, y, 'ZEUGE(N)',             verfahren.zeugen            || '', FIELD_H + 10);
    y = drawBigField(doc, y, 'WEITERE BETEILIGTE',   verfahren.weitere_beteiligte || verfahren.zusatzinfo || '', FIELD_H);

    y = drawSection(doc, y + 8, '2', 'NOTIZEN');
    const notizText = notizen.length > 0
      ? notizen.map((n, i) => `${i + 1}. ${n.notiz} (${n.erstellt_von})`).join('\n')
      : '';
    y = drawBigField(doc, y, 'ZUSÄTZLICHE INFORMATIONEN', notizText, 100);

    drawPageFooter(doc, 3, 4);

    // ── Seite 4: Entscheidung & Abschluss ──
    doc.addPage();
    drawPageHeader(doc, 'ENTSCHEIDUNG & ABSCHLUSS', 'J', 4, 4);
    y = MARGIN + 60;

    y = drawSection(doc, y, '1', 'ENTSCHEIDUNG / URTEIL');
    y = drawBigField(doc, y, 'URTEIL / ENTSCHEIDUNG', verfahren.urteil || '', 80);
    y = drawBigField(doc, y, 'STRAFE / MASSNAHME',    verfahren.strafe || '', 80);

    y = drawSection(doc, y + 8, '2', 'ABSCHLUSS');
    y = drawFieldRow(doc, y, [
      { label: 'AKTE GESCHLOSSEN AM',    value: formatDate(verfahren.abgeschlossen_am || verfahren.erstellt_am), w: CONTENT_W * 0.55 },
      { label: 'ABGESCHLOSSEN DURCH',   value: verfahren.abgeschlossen_von_name || '',                          w: CONTENT_W * 0.45 },
    ]);

    // Checkbox "Akte geprüft"
    doc.rect(MARGIN, y + 8, 10, 10).stroke(C_BORDER);
    doc.fontSize(8).fillColor(C_BODY_TXT).font('Helvetica')
      .text('Akte geprüft und vollständig dokumentiert', MARGIN + 14, y + 9);
    y += 28;

    // Trennlinie
    doc.moveTo(MARGIN, y + 6).lineTo(MARGIN + CONTENT_W, y + 6).strokeColor(C_LINE).lineWidth(0.5).stroke();
    y += 16;

    // Unterschrift-Zeilen
    doc.fontSize(7).fillColor(C_LABEL).font('Helvetica')
      .text('UNTERSCHRIFT BEARBEITER', MARGIN, y)
      .text('DATUM', MARGIN + CONTENT_W * 0.6, y);
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W * 0.5, y).strokeColor(C_BODY_TXT).lineWidth(0.5).stroke();
    doc.moveTo(MARGIN + CONTENT_W * 0.6, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(C_BODY_TXT).lineWidth(0.5).stroke();
    y += 24;

    // Hinweis-Box
    doc.rect(MARGIN, y, CONTENT_W, 42).fillAndStroke('#f5f5f0', C_GOLD);
    doc.fontSize(8).fillColor(C_BODY_TXT).font('Helvetica-Bold')
      .text('HINWEIS', MARGIN + 8, y + 6);
    doc.font('Helvetica').fontSize(7.5).fillColor(C_BODY_TXT)
      .text(
        'Diese Vorlage ist ausschließlich für das fiktive Roblox-Roleplay des Deutschen RP Servers bestimmt.\n' +
        'Keine echten personenbezogenen Daten oder realen Gerichtsverfahren eintragen.',
        MARGIN + 8, y + 18, { width: CONTENT_W - 16 }
      );

    drawPageFooter(doc, 4, 4);

    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZEICHENFUNKTIONEN
// ═══════════════════════════════════════════════════════════════════════════════

/** Kopfzeile oben auf jeder Seite */
function drawPageHeader(doc: PDFKit.PDFDocument, rechts: string, buchstabe: string, seite: number, gesamt: number): void {
  const y = MARGIN;

  // Linker Teil: dunkelblauer Balken mit Logo-Kreis
  doc.rect(MARGIN, y, CONTENT_W, 44).fill(C_HEADER_BG);

  // Logo-Kreis
  doc.circle(MARGIN + 22, y + 22, 16).fill(C_GOLD);
  doc.fontSize(13).fillColor(C_HEADER_BG).font('Helvetica-Bold')
    .text(buchstabe, MARGIN + 17, y + 15);

  // Titel + Untertitel
  doc.fontSize(13).fillColor(C_HEADER_TXT).font('Helvetica-Bold')
    .text('DEUTSCHER RP SERVER', MARGIN + 46, y + 6);
  doc.fontSize(8).fillColor('#aabbcc').font('Helvetica')
    .text('Justizakte — Ermittlung, Strafverfahren & Gerichtsverfahren', MARGIN + 46, y + 22);

  // Rechts: Goldene Sektion + Seitenzahl
  const rw = 160;
  const rx = MARGIN + CONTENT_W - rw;
  doc.rect(rx, y, rw, 44).fill(C_GOLD);
  doc.fontSize(9).fillColor(C_HEADER_BG).font('Helvetica-Bold')
    .text(rechts, rx + 8, y + 8, { width: rw - 12, align: 'right' });
  doc.fontSize(8).fillColor(C_HEADER_BG).font('Helvetica')
    .text(`Seite ${seite} von ${gesamt}`, rx + 8, y + 24, { width: rw - 12, align: 'right' });
}

/** Seitentitel + Untertitel */
function drawPageTitle(doc: PDFKit.PDFDocument, titel: string, untertitel: string): number {
  const y = MARGIN + 56;
  doc.fontSize(20).fillColor(C_BODY_TXT).font('Helvetica-Bold').text(titel, MARGIN, y);
  doc.fontSize(8).fillColor(C_LABEL).font('Helvetica').text(untertitel, MARGIN, y + 24);
  return y + 42;
}

/** Sektions-Header (dunkelblau + goldene Nummer) */
function drawSection(doc: PDFKit.PDFDocument, y: number, nr: string, titel: string): number {
  // Hintergrund
  doc.rect(MARGIN, y, CONTENT_W, SECTION_H).fill(C_SECTION_BG);
  // Goldene Nummer-Box
  doc.rect(MARGIN, y, 28, SECTION_H).fill(C_GOLD);
  doc.fontSize(10).fillColor(C_HEADER_BG).font('Helvetica-Bold')
    .text(nr, MARGIN + 9, y + 6);
  // Titel
  doc.fontSize(9).fillColor(C_WHITE).font('Helvetica-Bold')
    .text(titel, MARGIN + 36, y + 6);
  return y + SECTION_H + 4;
}

/** Trennlinie */
function drawDivider(doc: PDFKit.PDFDocument, y: number): number {
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(C_LINE).lineWidth(0.5).stroke();
  return y + 8;
}

/** Eine Zeile mit mehreren Feldern nebeneinander */
function drawFieldRow(
  doc: PDFKit.PDFDocument,
  y: number,
  fields: Array<{ label: string; value: string; w: number }>
): number {
  let x = MARGIN;
  const h = FIELD_H + 4;

  fields.forEach((f, i) => {
    const fw = f.w - (i < fields.length - 1 ? 4 : 0);

    // Label
    doc.fontSize(6.5).fillColor(C_LABEL).font('Helvetica')
      .text(f.label, x + 2, y + 2, { width: fw - 4 });

    // Eingabe-Box
    doc.rect(x, y + 11, fw, FIELD_H - 8).fillAndStroke('#fafafa', C_BORDER);

    // Wert
    if (f.value) {
      doc.fontSize(8.5).fillColor(C_BODY_TXT).font('Helvetica')
        .text(f.value, x + 4, y + 15, { width: fw - 8, ellipsis: true, lineBreak: false });
    }

    x += f.w;
  });

  // Trennlinie danach
  doc.moveTo(MARGIN, y + h).lineTo(MARGIN + CONTENT_W, y + h).strokeColor(C_LINE).lineWidth(0.3).stroke();

  return y + h + 4;
}

/** Großes mehrzeiliges Feld */
function drawBigField(doc: PDFKit.PDFDocument, y: number, label: string, value: string, h: number): number {
  doc.fontSize(6.5).fillColor(C_LABEL).font('Helvetica').text(label, MARGIN, y + 2);
  doc.rect(MARGIN, y + 11, CONTENT_W, h).fillAndStroke('#fafafa', C_BORDER);

  if (value) {
    doc.fontSize(8).fillColor(C_BODY_TXT).font('Helvetica')
      .text(value, MARGIN + 4, y + 15, { width: CONTENT_W - 8, height: h - 8, ellipsis: true });
  }

  const total = h + 18;
  doc.moveTo(MARGIN, y + total).lineTo(MARGIN + CONTENT_W, y + total).strokeColor(C_LINE).lineWidth(0.3).stroke();
  return y + total + 4;
}

/** Status-Checkboxen (Seite 1) */
function drawStatusCheckboxes(doc: PDFKit.PDFDocument, y: number, status: string): number {
  const statuses = ['Offen', 'Ermittlung', 'Strafverfahren', 'Gerichtsverfahren', 'Abgeschlossen'];
  const statusMap: Record<string, string> = {
    offen: 'Offen', ermittlung: 'Ermittlung', strafverfahren: 'Strafverfahren',
    gerichtsverfahren: 'Gerichtsverfahren', abgeschlossen: 'Abgeschlossen',
  };
  const aktiv = statusMap[status?.toLowerCase()] || 'Abgeschlossen';
  const boxW = CONTENT_W / statuses.length;

  statuses.forEach((s, i) => {
    const x = MARGIN + i * boxW;
    const checked = s === aktiv;

    // Checkbox
    doc.rect(x + 2, y + 4, 9, 9).stroke(C_BORDER);
    if (checked) {
      // Haken / Füllung
      doc.rect(x + 3.5, y + 5.5, 6, 6).fill(C_GOLD);
    }

    doc.fontSize(8).fillColor(C_BODY_TXT).font(checked ? 'Helvetica-Bold' : 'Helvetica')
      .text(s, x + 14, y + 5);
  });

  doc.moveTo(MARGIN, y + 20).lineTo(MARGIN + CONTENT_W, y + 20).strokeColor(C_LINE).lineWidth(0.3).stroke();
  return y + 28;
}

/** Fußzeile */
function drawPageFooter(doc: PDFKit.PDFDocument, seite: number, gesamt: number): void {
  const y = PAGE_H - MARGIN - 18;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(C_LINE).lineWidth(0.5).stroke();
  doc.fontSize(7).fillColor(C_FOOTER_TXT).font('Helvetica-Oblique')
    .text(
      'Fiktive Vorlage für das Roblox-Roleplay des Deutschen RP Servers — keine echten personenbezogenen Daten eintragen.',
      MARGIN, y + 4, { width: CONTENT_W - 60 }
    )
    .text(`Seite ${seite}/${gesamt}`, MARGIN, y + 4, { width: CONTENT_W, align: 'right' });
}

/** Datum formatieren */
function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}
