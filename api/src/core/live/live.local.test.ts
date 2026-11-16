import { describe, expect, it } from 'vitest'
import { createLocalLiveProvider } from './live.local'
import type { LiveListener, LiveMessage } from './live.type'

const poke = { seq: 3, deviceId: 'phone' }

const listener = (userId: string, books: string[] = []) => {
  const got: LiveMessage[] = []
  const value: LiveListener = {
    userId,
    mayListen: async (bookId) => Promise.resolve(books.includes(bookId)),
    send: (message) => got.push(message),
  }
  return { value, got }
}

describe('createLocalLiveProvider', () => {
  it("sends a user: poke to that user's streams only", async () => {
    const provider = createLocalLiveProvider()
    const alice = listener('alice')
    const bob = listener('bob')
    provider.listen?.(alice.value)
    provider.listen?.(bob.value)
    await provider.publish({ channel: 'user:alice', poke })
    expect(alice.got).toEqual([{ channel: 'user:alice', poke }])
    expect(bob.got).toEqual([])
  })

  it('sends a book: poke to the streams that may hear it (rule 3), asked on each poke', async () => {
    const provider = createLocalLiveProvider()
    const member = listener('bob', ['pa'])
    const stranger = listener('carol')
    provider.listen?.(member.value)
    provider.listen?.(stranger.value)
    await provider.publish({ channel: 'book:pa', poke })
    expect(member.got).toHaveLength(1)
    expect(stranger.got).toEqual([])
  })

  it('stops sending once the listener is removed', async () => {
    const provider = createLocalLiveProvider()
    const alice = listener('alice')
    const stop = provider.listen?.(alice.value)
    stop?.()
    await provider.publish({ channel: 'user:alice', poke })
    expect(alice.got).toEqual([])
  })

  it('answers the local provider for a token, with no Ably token', async () => {
    const provider = createLocalLiveProvider()
    expect(await provider.token({ userId: 'alice', bookIds: ['pa'] })).toEqual({
      provider: 'local',
    })
  })
})
