import type { LiveRepository } from './live.repository'

/** Specs: who may hear which profile, as a plain map that a test may change. */
export const createMemoryLiveRepository = (
  profilesOf: Map<string, string[]> = new Map()
): LiveRepository & { profilesOf: Map<string, string[]> } => ({
  profilesOf,
  listenableProfiles: async (userId) => Promise.resolve(profilesOf.get(userId) ?? []),
})
