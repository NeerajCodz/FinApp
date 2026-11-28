/**
 * Small, dependency-light readers for FinAI attachments: CSV/TSV text and .xlsx workbooks
 * (a zip of XML, unpacked with fflate). Output is plain string grids so the same code feeds the
 * model prompt and the bulk-import tool. Dates in .xlsx cells formatted as dates come out as
 * `YYYY-MM-DD`; everything else is the cell's text.
 *
 * Limits keep hostile files cheap: at most `MAX_UNZIPPED_BYTES` of XML is inflated (zip bombs
 * are refused before inflating), and grids are cut at `MAX_ROWS` × `MAX_COLUMNS`.
 */
import { unzipSync } from 'fflate';

export const MAX_ROWS = 5_000;
export const MAX_COLUMNS = 60;
const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024;
const MAX_SHEETS = 12;

export type Sheet = { name: string; rows: string[][]; truncated: boolean; omittedSheets?: number };

// ---------- CSV ----------

const CSV_DELIMITERS = [',', ';', '\t', '|'] as const;
const MAX_DELIMITER_SAMPLE_CHARS = 64 * 1024;
const MAX_DELIMITER_SAMPLE_RECORDS = 100;

/** Scores delimiter widths in a bounded sample and ignores separators inside quoted fields. */
function detectDelimiter(text: string): string {
  const widthCounts = CSV_DELIMITERS.map(() => new Map<number, number>());
  const separatorsInRow = CSV_DELIMITERS.map(() => 0);
  let sampledRecords = 0;
  let insideQuote = false;
  let canOpenQuote = true;

  const recordSample = () => {
    for (let index = 0; index < CSV_DELIMITERS.length; index++) {
      const width = separatorsInRow[index]! + 1;
      if (width > 1) {
        const counts = widthCounts[index]!;
        counts.set(width, (counts.get(width) ?? 0) + 1);
      }
      separatorsInRow[index] = 0;
    }
    sampledRecords++;
    canOpenQuote = true;
  };

  for (
    let index = 0;
    index < text.length &&
    index < MAX_DELIMITER_SAMPLE_CHARS &&
    sampledRecords < MAX_DELIMITER_SAMPLE_RECORDS;
    index++
  ) {
    const char = text[index]!;
    if (insideQuote) {
      if (char !== '"') continue;
      if (text[index + 1] === '"') {
        index++;
        continue;
      }
      insideQuote = false;
      canOpenQuote = false;
      continue;
    }
    if (char === '"' && canOpenQuote) {
      insideQuote = true;
      continue;
    }
    if (char === '\r' || char === '\n') {
      recordSample();
      if (char === '\r' && text[index + 1] === '\n') index++;
      continue;
    }

    const delimiterIndex = CSV_DELIMITERS.indexOf(char as (typeof CSV_DELIMITERS)[number]);
    if (delimiterIndex >= 0) {
      separatorsInRow[delimiterIndex] = separatorsInRow[delimiterIndex]! + 1;
      canOpenQuote = true;
    } else canOpenQuote = false;
  }

  if (
    sampledRecords < MAX_DELIMITER_SAMPLE_RECORDS &&
    text.length <= MAX_DELIMITER_SAMPLE_CHARS &&
    separatorsInRow.some((count) => count > 0)
  )
    recordSample();

  let selectedDelimiter: string = CSV_DELIMITERS[0];
  let selectedScore = 0;
  for (let index = 0; index < CSV_DELIMITERS.length; index++) {
    let mostRepeatedWidth = 0;
    let rowsWithColumns = 0;
    for (const count of widthCounts[index]!.values()) {
      mostRepeatedWidth = Math.max(mostRepeatedWidth, count);
      rowsWithColumns += count;
    }
    const score = mostRepeatedWidth * 100 + rowsWithColumns;
    if (score > selectedScore) {
      selectedDelimiter = CSV_DELIMITERS[index]!;
      selectedScore = score;
    }
  }
  return selectedDelimiter;
}

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines in quotes), delimiter auto-detected. */
export function parseCsv(input: string, name = 'Sheet1'): Sheet {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let truncated = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row.slice(0, MAX_COLUMNS));
    if (row.length > MAX_COLUMNS) truncated = true;
    row = [];
  };
  for (let index = 0; index < text.length; index++) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endRow();
    } else field += char;
  }
  if (rows.length < MAX_ROWS && (field !== '' || row.length)) endRow();
  return { name, rows: rows.map((cells) => cells.map((cell) => cell.trim())), truncated };
}

// ---------- XLSX ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** All `<t>` text inside a string item (rich text runs joined, phonetic runs skipped). */
function itemText(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const match of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    out += decodeXml(match[1]!);
  return out;
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** "AB12" → 27 (zero-based column index). */
function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47]);

/** Which cell style indexes (`s="…"`) are dates, from styles.xml. */
function dateStyles(stylesXml: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!stylesXml) return result;
  const customDates = new Set<number>();
  for (const match of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(match[0], 'numFmtId'));
    const code = decodeXml(attr(match[0], 'formatCode') ?? '')
      .replace(/"[^"]*"|\[[^\]]*\]/g, '')
      .toLowerCase();
    // Day or year parts mean a date (a bare "m" could be minutes).
    if (/[dy]/.test(code)) customDates.add(id);
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  let index = 0;
  for (const match of cellXfs.matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    const id = Number(attr(match[0], 'numFmtId') ?? '0');
    if (BUILTIN_DATE_FORMATS.has(id) || customDates.has(id)) result.add(index);
    index++;
  }
  return result;
}

/** Excel serial day (1900 system) → `YYYY-MM-DD`. */
export function excelSerialToIso(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2_958_465) return null;
  if (date1904)
    return new Date(Date.UTC(1904, 0, 1) + Math.floor(serial) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  const days = Math.floor(serial) - (serial >= 60 ? 25_569 : 25_568);
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

function sheetRows(xml: string, shared: string[], dates: Set<number>, date1904: boolean) {
  const rows: string[][] = [];
  let truncated = false;
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const body = rowMatch[2];
    if (!body) continue;
    const declared = Number(attr(` ${rowMatch[1] ?? ''}`, 'r'));
    // Keep blank rows between data so row numbers in messages match the sheet.
    if (Number.isFinite(declared) && declared > rows.length + 1)
      while (rows.length < declared - 1 && rows.length < MAX_ROWS) rows.push([]);
    const cells: string[] = [];
    let next = 0;
    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cellMatch[1] ?? ''}`;
      const ref = attr(tag, 'r');
      const column = ref ? columnIndex(ref) : next;
      next = column + 1;
      if (column >= MAX_COLUMNS) {
        truncated = true;
        continue;
      }
      const inner = cellMatch[2] ?? '';
      const type = attr(tag, 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = itemText(inner);
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str' || type === 'e') value = decodeXml(raw ?? '');
      else if (raw !== undefined) {
        const style = Number(attr(tag, 's') ?? '-1');
        const number = Number(raw);
        value = dates.has(style) ? (excelSerialToIso(number, date1904) ?? raw) : raw;
      }
      while (cells.length < column) cells.push('');
      cells[column] = value.trim();
    }
    rows.push(cells);
  }
  while (rows.length && rows[rows.length - 1]!.every((cell) => cell === '')) rows.pop();
  return { rows, truncated };
}

/** Reads every worksheet of an .xlsx workbook (first `MAX_SHEETS`). Throws on a broken file. */
export function readXlsx(bytes: Uint8Array): Sheet[] {
  let inflated = 0;
  const files = unzipSync(bytes, {
    filter: (file) => {
      const wanted =
        file.name === 'xl/workbook.xml' ||
        file.name === 'xl/_rels/workbook.xml.rels' ||
        file.name === 'xl/sharedStrings.xml' ||
        file.name === 'xl/styles.xml' ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name);
      if (!wanted) return false;
      inflated += file.originalSize;
      if (inflated > MAX_UNZIPPED_BYTES) throw new Error('SPREADSHEET_TOO_LARGE');
      return true;
    },
  });
  const text = (name: string) => (files[name] ? new TextDecoder().decode(files[name]) : undefined);
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error('INVALID_SPREADSHEET');
  const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (match) => itemText(match[1]!),
  );
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/i.test(workbook);
  const rels = new Map<string, string>();
  for (const match of (text('xl/_rels/workbook.xml.rels') ?? '').matchAll(
    /<Relationship\b[^>]*>/g,
  )) {
    const id = attr(match[0], 'Id');
    const target = attr(match[0], 'Target');
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const sheets: Sheet[] = [];
  const dates = dateStyles(text('xl/styles.xml'));
  let omittedSheets = 0;
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    if (sheets.length >= MAX_SHEETS) {
      omittedSheets += 1;
      continue;
    }
    const name = decodeXml(attr(match[0], 'name') ?? `Sheet${sheets.length + 1}`);
    const relId = attr(match[0], 'r:id');
    const path = (relId && rels.get(relId)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = text(path);
    if (!xml) continue;
    const { rows, truncated } = sheetRows(xml, shared, dates, date1904);
    sheets.push({ name, rows, truncated });
  }
  if (omittedSheets > 0) {
    const lastSheet = sheets[MAX_SHEETS - 1];
    if (lastSheet) lastSheet.omittedSheets = omittedSheets;
  }

  if (!sheets.length) throw new Error('INVALID_SPREADSHEET');
  return sheets;
}

// ---------- Prompt rendering ----------

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Renders the header and as many rows as fit, reserving prompt space for an accurate omission note.
 */
export function sheetForPrompt(sheet: Sheet, maxChars: number): string {
  const limit = Math.max(0, maxChars);
  if (!limit) return '';

  let rowCount = 0;
  for (const row of sheet.rows) if (row.some((cell) => cell !== '')) rowCount++;

  const omissionNote = (included: number) => {
    const details: string[] = [];
    const notShown = rowCount - included;
    if (sheet.truncated) {
      details.push(
        `${rowCount} rows parsed; parser limit reached at ${MAX_ROWS} rows (total unknown)`,
      );
      if (notShown > 0) details.push(`${notShown} more parsed`);
    } else if (notShown > 0) {
      details.push(`${rowCount} rows total; ${notShown} not shown`);
    }
    if (sheet.omittedSheets) details.push(`${sheet.omittedSheets} additional sheets not parsed`);
    return `… ${details.join('; ')}`;
  };

  let included = 0;
  let prompt = '';
  for (const row of sheet.rows) {
    if (!row.some((cell) => cell !== '')) continue;
    const line = row.map(csvCell).join(',');
    const candidate = prompt ? `${prompt}\n${line}` : line;
    const candidateCount = included + 1;
    const needsNote =
      candidateCount < rowCount || sheet.truncated === true || (sheet.omittedSheets ?? 0) > 0;
    const rendered = needsNote ? `${candidate}\n${omissionNote(candidateCount)}` : candidate;
    if (rendered.length > limit) break;
    prompt = candidate;
    included = candidateCount;
  }

  if (included === rowCount && !sheet.truncated && !sheet.omittedSheets) return prompt;
  const suffix = omissionNote(included);
  return (prompt ? `${prompt}\n${suffix}` : suffix).slice(0, limit);
}
