import type { LiveChannel } from './live.type'

export const userChannel = (userId: string): LiveChannel => `user:${userId}`
export const bookChannel = (bookId: string): LiveChannel => `book:${bookId}`
