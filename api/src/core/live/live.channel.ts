import type { LiveChannel } from './live.type'

export const userChannel = (userId: string): LiveChannel => `user:${userId}`
export const profileChannel = (profileId: string): LiveChannel => `profile:${profileId}`
