/** Starts a cell a spreadsheet would run as a formula (OWASP "CSV injection"). */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * Text for a CSV cell that a spreadsheet must show as text: one starting like a formula gets a
 * leading `'` (docs/features/export.md rule 6). Numbers the file means as numbers skip this.
 * e.g. `csvText('=1+1')` → `"'=1+1"`, `csvText('-50')` → `"'-50"`, `csvText('ข้าวเย็น')` → `'ข้าวเย็น'`
 */
export const csvText = (text: string): string => (FORMULA_START.test(text) ? `'${text}` : text)

/**
 * One RFC 4180 field: quoted when it holds `,`, `"` or a line break, `"` doubled.
 * e.g. `csvField('a,b')` → `'"a,b"'`, `csvField('say "hi"')` → `'"say ""hi"""'`, `csvField('plain')` → `'plain'`
 */
export const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/**
 * A whole CSV file: a UTF-8 BOM (so Excel reads Thai), comma separated, CRLF line ends
 * (export.md rule 5). e.g. `toCsv([['a', 'b,c'], ['1', '2']])` → `'\uFEFFa,"b,c"\r\n1,2\r\n'`
 */
export const toCsv = (rows: readonly (readonly string[])[]): string =>
  '\uFEFF' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'

/**
 * The file name (rule 5): `tangpainai-<book>-<day>.csv` with the book's name kept to
 * ASCII letters, digits, `-` and `_` (browsers drop a download name with other characters, so
 * a Thai name is left out: `tangpainai-<day>.csv`).
 * e.g. `exportFileName('My Book 2026', '2026-11-18')` → `'tangpainai-My-Book-2026-2026-11-18.csv'`,
 * `exportFileName('ส่วนตัว', '2026-11-18')` → `'tangpainai-2026-11-18.csv'`
 */
export const exportFileName = (bookName: string, day: string): string => {
  const part = bookName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return part ? `tangpainai-${part}-${day}.csv` : `tangpainai-${day}.csv`
}
