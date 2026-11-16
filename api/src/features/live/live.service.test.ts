import { describe, expect, it } from 'vitest'
import { createLocalLiveProvider, createMemoryLiveProvider } from '@/core/live'
import type { LiveMessage } from '@/core/live'
import { LiveProviderName } from '@/shared/types'
import { createMemoryLiveRepository } from './live.repository.memory'
import { createLiveService } from './live.service'

const poke = { seq: 9, deviceId: 'phone' }

describe('createLiveService › token', () => {
  it('grants an Ably token for the user and the profiles they may hear now (rule 8)', async () => {
    const provider = createMemoryLiveProvider(LiveProviderName.ABLY)
    const liveRepo = createMemoryLiveRepository(new Map([['bob', ['pa']]]))
    const service = createLiveService({ liveRepo, provider })
    expect(await service.token('bob')).toMatchObject({ provider: 'ably' })
    liveRepo.profilesOf.set('bob', [])
    await service.token('bob')
    expect(provider.grants).toEqual([
      { userId: 'bob', profileIds: ['pa'] },
      { userId: 'bob', profileIds: [] },
    ])
  })

  it('answers only the provider for local and disabled', async () => {
    for (const name of [LiveProviderName.LOCAL, LiveProviderName.DISABLED]) {
      const service = createLiveService({
        liveRepo: createMemoryLiveRepository(),
        provider: createMemoryLiveProvider(name),
      })
      expect(await service.token('bob')).toEqual({ provider: name })
    }
  })
})

describe('createLiveService › listen', () => {
  it('refuses a stream unless the provider is local (404)', () => {
    const service = createLiveService({
      liveRepo: createMemoryLiveRepository(),
      provider: createMemoryLiveProvider(LiveProviderName.ABLY),
    })
    expect(() => service.listen('bob', () => undefined)).toThrow('Live stream not found')
  })

  it("delivers a shared profile's pokes while the user may hear it (rule 3, per poke)", async () => {
    const provider = createLocalLiveProvider()
    const liveRepo = createMemoryLiveRepository(new Map([['bob', ['pa']]]))
    const service = createLiveService({ liveRepo, provider })
    const got: LiveMessage[] = []
    service.listen('bob', (message) => got.push(message))
    await provider.publish({ channel: 'profile:pa', poke })
    liveRepo.profilesOf.set('bob', [])
    await provider.publish({ channel: 'profile:pa', poke })
    await provider.publish({ channel: 'user:bob', poke })
    expect(got.map((m) => m.channel)).toEqual(['profile:pa', 'user:bob'])
  })
})
