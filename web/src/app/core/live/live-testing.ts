import { signal } from '@angular/core'
import type { Provider } from '@angular/core'
import { LiveService } from './live.service'
import type { LiveListener } from './live.type'

/**
 * Specs: a `LiveService` that never connects; `listeners` holds who listens, by channel key, and
 * `connected` can be set to act as a live connection.
 */
export const fakeLive = () => {
  const listeners = new Map<string, LiveListener>()
  const listen = (key: string, listener: LiveListener) => {
    listeners.set(key, listener)
    return () => {
      listeners.delete(key)
    }
  }
  const value = {
    provider: signal(null),
    connected: signal(false),
    listenUser: (listener: LiveListener) => listen('user', listener),
    listenBook: (bookId: string, listener: LiveListener) => listen(`book:${bookId}`, listener),
  } satisfies Pick<LiveService, 'provider' | 'connected' | 'listenUser' | 'listenBook'>
  return {
    listeners,
    connected: value.connected,
    provider: { provide: LiveService, useValue: value } satisfies Provider,
  }
}

/** Specs that don't exercise live sync: it asks the API for nothing. */
export const provideNoLive = (): Provider => fakeLive().provider
