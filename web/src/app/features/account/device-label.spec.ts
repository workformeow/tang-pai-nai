import { deviceLabel, deviceRow, relativeTime } from './device-label'

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  samsungTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Safari/537.36',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
}

describe('deviceLabel', () => {
  it.each([
    [UA.androidChrome, 'Chrome · Android', 'phone'],
    [UA.iphoneSafari, 'Safari · iPhone', 'phone'],
    [UA.iphoneChrome, 'Chrome · iPhone', 'phone'],
    [UA.windowsEdge, 'Edge · Windows', 'computer'],
    [UA.samsungTablet, 'Samsung Internet · Android', 'tablet'],
    [UA.macFirefox, 'Firefox · Mac', 'computer'],
    [UA.lineIos, 'LINE · iPhone', 'phone'],
  ])('names %s', (userAgent, name, kind) => {
    expect(deviceLabel(userAgent)).toEqual({ name, kind })
  })

  it('has no name for a missing or unknown user agent', () => {
    expect(deviceLabel(null)).toEqual({ name: null, kind: 'computer' })
    expect(deviceLabel('curl/8.5.0')).toEqual({ name: null, kind: 'computer' })
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-11-18T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms)

  it('is null under a minute, then whole minutes, hours or days', () => {
    expect(relativeTime(ago(30_000), now, 'en-GB')).toBeNull()
    expect(relativeTime(ago(5 * 60_000), now, 'en-GB')).toBe('5 minutes ago')
    expect(relativeTime(ago(3 * 3_600_000 + 59 * 60_000), now, 'en-GB')).toBe('3 hours ago')
    expect(relativeTime(ago(2 * 86_400_000), now, 'en-GB')).toBe('2 days ago')
  })
})

describe('deviceRow', () => {
  const now = Date.parse('2026-11-18T12:00:00Z')
  const session = (signedInAt: string) => ({
    id: 's1',
    userAgent: UA.androidChrome,
    signedInAt,
    lastUsedAt: '2026-11-18T11:50:00Z',
    current: false,
  })

  it('names the device, picks its icon and dates the sign-in (with the year only when not this year)', () => {
    const row = deviceRow(session('2026-11-05T09:00:00Z'), 'en-GB', now)
    expect(row.label.name).toBe('Chrome · Android')
    expect(row.icon).toBe('lucideSmartphone')
    expect(row.signedIn).toBe('5 Nov')
    expect(row.lastActive).toBe('10 minutes ago')
    expect(deviceRow(session('2025-11-05T09:00:00Z'), 'en-GB', now).signedIn).toBe('5 Nov 2025')
  })
})

describe('doc examples (device-label.ts)', () => {
  it('match the e.g. lines', () => {
    expect(deviceLabel(UA.androidChrome)).toEqual({ name: 'Chrome · Android', kind: 'phone' })
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      )
    ).toEqual({ name: 'Safari · iPad', kind: 'tablet' })
    expect(deviceLabel(null)).toEqual({ name: null, kind: 'computer' })
  })
})
