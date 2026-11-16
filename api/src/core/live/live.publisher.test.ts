import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/core/logger'
import { LiveProviderName } from '@/shared/types'
import { createLivePublisher } from './live.publisher'
import type { LiveMessage } from './live.type'

const message = (channel: LiveMessage['channel']): LiveMessage => ({
  channel,
  poke: { seq: 7, deviceId: 'phone' },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createLivePublisher', () => {
  it('publishes every message', async () => {
    const sent: LiveMessage[] = []
    const publisher = createLivePublisher({
      name: LiveProviderName.ABLY,
      publish: async (m) => {
        sent.push(m)
        return Promise.resolve()
      },
    })
    await publisher.publish([message('user:alice'), message('book:pa')])
    expect(sent.map((m) => m.channel)).toEqual(['user:alice', 'book:pa'])
  })

  it('logs a failed publish as a warning and still resolves (live-sync rule 7)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockReturnValue(undefined)
    const publisher = createLivePublisher({
      name: LiveProviderName.ABLY,
      publish: async (m) =>
        m.channel === 'user:alice' ? Promise.reject(new Error('down')) : Promise.resolve(),
    })
    await expect(
      publisher.publish([message('user:alice'), message('book:pa')])
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][1]).toEqual({ channel: 'user:alice', cause: 'down' })
  })

  it('gives up on a publish that takes longer than the timeout', async () => {
    const warn = vi.spyOn(logger, 'warn').mockReturnValue(undefined)
    const publisher = createLivePublisher(
      { name: LiveProviderName.ABLY, publish: async () => new Promise(() => undefined) },
      20
    )
    const started = Date.now()
    await publisher.publish([message('user:alice')])
    expect(Date.now() - started).toBeLessThan(1_000)
    expect(warn.mock.calls[0][1]).toEqual({
      channel: 'user:alice',
      cause: 'timed out after 20 ms',
    })
  })
})
