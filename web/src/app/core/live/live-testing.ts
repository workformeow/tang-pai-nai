import { signal } from '@angular/core'
import type { Provider } from '@angular/core'
import { LiveService } from './live.service'

/** Specs: a `LiveService` that never connects, so it asks the API for nothing. */
export const provideNoLive = (): Provider => ({
  provide: LiveService,
  useValue: {
    provider: signal(null),
    connected: signal(false),
    listenUser: () => () => undefined,
    listenProfile: () => () => undefined,
  } satisfies Pick<LiveService, 'provider' | 'connected' | 'listenUser' | 'listenProfile'>,
})
