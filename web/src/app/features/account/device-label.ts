import type { AuthDeviceSession } from '@/core/auth'

/** What a session row shows for its user agent (auth spec rule 28). */
export interface DeviceLabel {
  /** `Chrome · Android`, or `null` when the user agent says nothing we know. */
  name: string | null
  kind: 'phone' | 'tablet' | 'computer'
}

// First match wins, so the browsers built on Chrome (and Chrome on iOS) come before Chrome itself.
const BROWSERS: [RegExp, string][] = [
  [/EdgA?\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\/|Opera/, 'Opera'],
  [/Line\//, 'LINE'],
  [/FBAN|FBAV/, 'Facebook'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/FxiOS\/|Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPod/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Linux/, 'Linux'],
]

const firstMatch = (userAgent: string, table: [RegExp, string][]): string | null =>
  table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null

/**
 * A short, human name for a user agent: browser and system ("Chrome · Android"). It's a hint for
 * the owner, not a security check: any client can send any user agent.
 * e.g. Chrome on an Android phone → `{ name: 'Chrome · Android', kind: 'phone' }`, Safari on an iPad →
 * `{ name: 'Safari · iPad', kind: 'tablet' }`, `deviceLabel(null)` → `{ name: null, kind: 'computer' }`
 */
export const deviceLabel = (userAgent: string | null): DeviceLabel => {
  if (!userAgent) {
    return { name: null, kind: 'computer' }
  }
  const browser = firstMatch(userAgent, BROWSERS)
  const system = firstMatch(userAgent, SYSTEMS)
  const name = [browser, system].filter(Boolean).join(' · ') || null
  const tablet =
    /iPad|Tablet/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
  const phone = !tablet && /Mobile|iPhone|iPod|Android/.test(userAgent)
  return { name, kind: tablet ? 'tablet' : phone ? 'phone' : 'computer' }
}

/** A signed-in device as the Security page lists it (auth spec rule 28). */
export interface DeviceRow {
  session: AuthDeviceSession
  label: DeviceLabel
  /** The icon for its kind of device. */
  icon: string
  /** The day it signed in (`5 พ.ย.`; with the year when not this year). */
  signedIn: string
  /** "5 นาทีที่ผ่านมา"; `null` under a minute ago ("just now"). */
  lastActive: string | null
}

const DEVICE_ICONS: Record<DeviceLabel['kind'], string> = {
  phone: 'lucideSmartphone',
  tablet: 'lucideTablet',
  computer: 'lucideMonitor',
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * How long ago, in whole minutes, hours or days; `null` under a minute.
 * e.g. (`en-GB`) 30 s before `now` → `null`, 5 min → `'5 minutes ago'`, 3 h 59 min →
 * `'3 hours ago'`, 2 days → `'2 days ago'`
 */
export const relativeTime = (at: Date, now: number, locale: string): string | null => {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const elapsed = now - at.getTime()
  if (elapsed < MINUTE) {
    return null
  }
  if (elapsed < HOUR) {
    return format.format(-Math.floor(elapsed / MINUTE), 'minute')
  }
  if (elapsed < DAY) {
    return format.format(-Math.floor(elapsed / HOUR), 'hour')
  }
  return format.format(-Math.floor(elapsed / DAY), 'day')
}

/** A session as its row in the device list, at `now` (ms). */
export const deviceRow = (session: AuthDeviceSession, locale: string, now: number): DeviceRow => {
  const label = deviceLabel(session.userAgent)
  const signedInAt = new Date(session.signedInAt)
  const sameYear = signedInAt.getFullYear() === new Date(now).getFullYear()
  return {
    session,
    label,
    icon: DEVICE_ICONS[label.kind],
    signedIn: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: sameYear ? undefined : 'numeric',
    }).format(signedInAt),
    lastActive: relativeTime(new Date(session.lastUsedAt), now, locale),
  }
}
