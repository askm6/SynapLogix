/** Reads a CSV (";" or "," separated) or Excel file into a header and rows of strings. */
import Papa from 'papaparse';
import type { RawRow } from './validation';

export interface ParsedFile {
  header: string[];
  rows: RawRow[];
}

const BOM = String.fromCharCode(0xfeff);
/** Excel adds a UTF-8 byte order mark at the start of CSV files. */
const stripBom = (text: string) => (text.startsWith(BOM) ? text.slice(1) : text);

export async function readTable(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // SheetJS is large: load it only when an Excel file is imported.
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
      defval: '',
    });
    const [head = [], ...body] = matrix;
    const header = head.map((h) => String(h).trim());
    const rows = body
      .filter((r) => r.some((cell) => String(cell).trim() !== ''))
      .map((r) => Object.fromEntries(header.map((h, i) => [h, String(r[i] ?? '').trim()])));
    return { header, rows };
  }
  const text = await file.text();
  const parsed = Papa.parse<RawRow>(stripBom(text), {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: '', // auto-detect ";" (the project format) or ","
    transformHeader: (h) => h.trim(),
  });
  return { header: parsed.meta.fields ?? [], rows: parsed.data };
}
