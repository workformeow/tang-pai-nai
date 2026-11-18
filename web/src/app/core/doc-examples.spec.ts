import { formatThaiMobile, normalizeThaiMobile } from './auth/phone'
import { isHiddenIn } from './wallet/hidden-categories'

// The e.g. lines in auth/phone.ts and wallet/hidden-categories.ts.

describe('doc examples (core)', () => {
  it('match the e.g. lines', () => {
    expect(normalizeThaiMobile('081-234-5678')).toBe('+66812345678')
    expect(normalizeThaiMobile('+66 81 234 5678')).toBe('+66812345678')
    expect(normalizeThaiMobile('021234567')).toBeNull()
    expect(formatThaiMobile('+66812345678')).toBe('081-234-5678')
    expect(isHiddenIn(['food'], { id: 'drinks', parentId: 'food' })).toBe(true)
    expect(isHiddenIn(['food'], { id: 'rent', parentId: null })).toBe(false)
  })
})
