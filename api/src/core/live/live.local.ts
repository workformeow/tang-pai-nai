import { LiveProviderName } from '@/shared/types'
import type { LiveListener, LiveMessage, LiveProvider } from './live.type'

const BOOK = 'book:'

/**
 * Rule 9: pokes straight to the open `GET /live/events` streams of this process. Listeners live
 * in memory, so it reaches only devices connected to the same API instance (dev, Docker).
 */
export const createLocalLiveProvider = (): LiveProvider => {
  const listeners = new Set<LiveListener>()

  const deliver = async (listener: LiveListener, message: LiveMessage): Promise<void> => {
    if (message.channel.startsWith(BOOK)) {
      if (await listener.mayListen(message.channel.slice(BOOK.length))) {
        listener.send(message)
      }
      return
    }
    if (message.channel === `user:${listener.userId}`) {
      listener.send(message)
    }
  }

  return {
    name: LiveProviderName.LOCAL,
    publish: async (message) => {
      await Promise.all([...listeners].map(async (listener) => deliver(listener, message)))
    },
    token: async () => Promise.resolve({ provider: LiveProviderName.LOCAL }),
    listen: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close: async () => {
      listeners.clear()
      return Promise.resolve()
    },
  }
}
