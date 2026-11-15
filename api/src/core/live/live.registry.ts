import type { EnvConfig } from '@/core/config'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { LiveProviderName } from '@/shared/types'
import { createAblyLiveProvider } from './live.ably'
import { createDisabledLiveProvider } from './live.disabled'
import { createLocalLiveProvider } from './live.local'
import type { LiveProvider } from './live.type'

// LIVE_PROVIDER picks one entry (docs/features/live-sync.md → Providers).
const liveProviders: Record<LiveProviderName, (env: EnvConfig) => LiveProvider> = {
  [LiveProviderName.DISABLED]: () => createDisabledLiveProvider(),
  [LiveProviderName.LOCAL]: () => createLocalLiveProvider(),
  [LiveProviderName.ABLY]: (env) => {
    if (!env.ABLY_API_KEY) {
      throw new AppError(
        ERRORS.requiredField('ABLY_API_KEY'),
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorSeverity.ERROR
      ).withOperation('createLiveProvider')
    }
    return createAblyLiveProvider({ apiKey: env.ABLY_API_KEY })
  },
}

export const createLiveProvider = (env: EnvConfig): LiveProvider =>
  liveProviders[env.LIVE_PROVIDER](env)
