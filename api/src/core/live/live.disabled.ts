import { LiveProviderName } from '@/shared/types'
import type { LiveProvider } from './live.type'

/** The default: nothing is published, devices keep their timed rounds only. */
export const createDisabledLiveProvider = (): LiveProvider => ({
  name: LiveProviderName.DISABLED,
  publish: async () => Promise.resolve(),
  token: async () => Promise.resolve({ provider: LiveProviderName.DISABLED }),
})
