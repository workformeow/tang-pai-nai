import type { LiveRepository } from './live.repository'

/** Specs: who may hear which book, as a plain map that a test may change. */
export const createMemoryLiveRepository = (
  booksOf: Map<string, string[]> = new Map()
): LiveRepository & { booksOf: Map<string, string[]> } => ({
  booksOf,
  listenableBooks: async (userId) => Promise.resolve(booksOf.get(userId) ?? []),
})
