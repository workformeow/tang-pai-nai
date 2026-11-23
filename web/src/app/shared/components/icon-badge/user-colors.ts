/**
 * The colours a user can pick for a book, wallet or category. User colours are data, the only
 * raw colours allowed (DESIGN.md §3). Each is dark enough for a **white** glyph at ≥ 4.5:1
 * (owner's choice in #7: white icons everywhere), so `glyphColor` picks white on all of them.
 */
export const USER_COLORS = [
  '#2563eb',
  '#0e7490',
  '#0f766e',
  '#15803d',
  '#a16207',
  '#c2410c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#475569',
] as const

/**
 * The shades of each `USER_COLORS` colour (its tone), light to dark, the colour itself among
 * them. The picker shows the 10 colours and, under the chosen one, its shades, so similar
 * wallets (two cards at one bank, two delivery apps) can stay apart without a long palette.
 * Every shade is dark enough for a white glyph too. Like the 10, a shipped shade stays.
 */
export const COLOR_SHADES: Readonly<Record<string, readonly string[]>> = {
  '#2563eb': ['#2563eb', '#4f46e5', '#1d4ed8', '#1e3a8a'],
  '#0e7490': ['#0e7490', '#0369a1', '#155e75', '#164e63'],
  '#0f766e': ['#0f766e', '#115e59', '#065f46', '#134e4a'],
  '#15803d': ['#4d7c0f', '#15803d', '#047857', '#14532d'],
  '#a16207': ['#a16207', '#b45309', '#854d0e', '#713f12'],
  '#c2410c': ['#c2410c', '#9a3412', '#78350f', '#7c2d12'],
  '#dc2626': ['#e11d48', '#dc2626', '#b91c1c', '#991b1b'],
  '#db2777': ['#db2777', '#be185d', '#a21caf', '#9d174d'],
  '#9333ea': ['#9333ea', '#7c3aed', '#6b21a8', '#581c87'],
  '#475569': ['#475569', '#57534e', '#334155', '#1f2937'],
}

/**
 * The `USER_COLORS` colour whose shades hold `hex`, or `null` for a colour outside the palette.
 * e.g. `colorTone('#14532D')` → `'#15803d'`, `colorTone('#15803d')` → `'#15803d'`,
 * `colorTone('#123456')` → `null`
 */
export const colorTone = (hex: string): string | null => {
  const color = hex.toLowerCase()
  return Object.keys(COLOR_SHADES).find((tone) => COLOR_SHADES[tone].includes(color)) ?? null
}

/**
 * Colours of the palette before #7, made one step darker then. Rows keep the hex they were saved
 * with, so they are drawn with the new colour (`userColor`) and saved with it on their next edit.
 */
const RENAMED_COLORS: Readonly<Record<string, string>> = {
  '#0891b2': '#0e7490',
  '#0d9488': '#0f766e',
  '#16a34a': '#15803d',
  '#ca8a04': '#a16207',
  '#ea580c': '#c2410c',
}

/**
 * The colour to draw for a stored `color` (an old palette colour becomes its darker one).
 * e.g. `userColor('#EA580C')` → `'#c2410c'`, `userColor('#2563eb')` → `'#2563eb'`
 */
export const userColor = (hex: string): string => RENAMED_COLORS[hex.toLowerCase()] ?? hex

const channel = (hex: string, at: number): number => {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of `#rrggbb`. */
const luminance = (hex: string): number =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)

/**
 * `#ffffff` or `#000000`, whichever has the higher contrast on `hex`.
 * e.g. `glyphColor('#2563eb')` → `'#ffffff'`, `glyphColor('#facc15')` → `'#000000'`,
 * `glyphColor('blue')` → `'#ffffff'`
 */
export const glyphColor = (hex: string): string => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return '#ffffff'
  }
  const l = luminance(hex)
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#000000'
}
