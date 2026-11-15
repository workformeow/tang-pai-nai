import { env } from '@/core/config'
import { onShutdown } from '@/core/server'
import { createLivePublisher } from './live.publisher'
import { createLiveProvider } from './live.registry'

/** The provider LIVE_PROVIDER picks (docs/features/live-sync.md). */
export const liveProvider = createLiveProvider(env)
export const livePublisher = createLivePublisher(liveProvider)
onShutdown(async () => liveProvider.close?.())

export { profileChannel, userChannel } from './live.channel'
export { createLivePublisher } from './live.publisher'
export { createLocalLiveProvider } from './live.local'
export { createMemoryLiveProvider } from './live.memory'
export type { LivePublisher } from './live.publisher'
export type * from './live.type'
