import { COLOR_SHADES, colorTone, glyphColor, USER_COLORS, userColor } from './user-colors'
import { FALLBACK_ICON, knownIcon, BOOK_ICON_NAMES } from './user-icons'

describe('glyphColor', () => {
  it('picks the glyph with the higher contrast', () => {
    expect(glyphColor('#2563eb')).toBe('#ffffff')
    expect(glyphColor('#ca8a04')).toBe('#000000')
    expect(glyphColor('#ffffff')).toBe('#000000')
    expect(glyphColor('#000000')).toBe('#ffffff')
  })

  it('falls back to white for something that is not #rrggbb', () => {
    expect(glyphColor('red')).toBe('#ffffff')
  })

  it('draws a white glyph on every palette colour', () => {
    expect(USER_COLORS.every((color) => glyphColor(color) === '#ffffff')).toBe(true)
  })

  it('gives every palette colour and shade a glyph of at least 4.5:1 contrast', () => {
    const channel = (hex: string, at: number) => {
      const v = parseInt(hex.slice(at, at + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const lum = (hex: string) =>
      0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
    for (const color of Object.values(COLOR_SHADES).flat()) {
      const [a, b] = [lum(color), lum(glyphColor(color))].sort((x, y) => y - x)
      expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('COLOR_SHADES', () => {
  it('gives every palette colour four shades, itself among them, each in one tone only', () => {
    expect(Object.keys(COLOR_SHADES)).toEqual([...USER_COLORS])
    for (const color of USER_COLORS) {
      expect(COLOR_SHADES[color]).toHaveLength(4)
      expect(COLOR_SHADES[color]).toContain(color)
    }
    const shades = Object.values(COLOR_SHADES).flat()
    expect(new Set(shades).size).toBe(shades.length)
    expect(shades.every((shade) => /^#[0-9a-f]{6}$/.test(shade))).toBe(true)
    expect(shades.every((shade) => glyphColor(shade) === '#ffffff')).toBe(true)
  })
})

describe('colorTone', () => {
  it('finds the palette colour a shade belongs to, ignoring case', () => {
    expect(colorTone('#14532D')).toBe('#15803d')
    expect(colorTone('#15803d')).toBe('#15803d')
    expect(colorTone('#1f2937')).toBe('#475569')
  })

  it('answers null for a colour outside the palette', () => {
    expect(colorTone('#123456')).toBeNull()
    expect(colorTone('#ca8a04')).toBeNull()
  })
})

describe('userColor', () => {
  it('draws an old palette colour with its darker one and keeps the rest', () => {
    expect(userColor('#ca8a04')).toBe('#a16207')
    expect(userColor('#0D9488')).toBe('#0f766e')
    expect(userColor('#2563eb')).toBe('#2563eb')
    expect(userColor('#123456')).toBe('#123456')
  })
})

describe('knownIcon', () => {
  it('keeps a curated icon and replaces an unknown one', () => {
    expect(knownIcon('lucideStore')).toBe('lucideStore')
    expect(knownIcon('lucideRocket')).toBe(FALLBACK_ICON)
    expect(BOOK_ICON_NAMES.every((name) => /^lucide[A-Z]/.test(name))).toBe(true)
  })
})
