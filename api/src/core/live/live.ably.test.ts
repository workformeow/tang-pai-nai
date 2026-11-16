import { describe, expect, it } from 'vitest'
import { LiveProviderName } from '@/shared/types'
import { createAblyLiveProvider } from './live.ably'

describe('createAblyLiveProvider', () => {
  it('signs a subscribe-only token request carrying the user as clientId (rule 8, MAU)', async () => {
    const provider = createAblyLiveProvider({ apiKey: 'appId.keyId:secret' })

    const result = await provider.token({ userId: 'bob', profileIds: ['home'] })

    expect(result.provider).toBe(LiveProviderName.ABLY)
    const tokenRequest = (result as { tokenRequest: Record<string, unknown> }).tokenRequest
    expect(tokenRequest).toMatchObject({ keyName: 'appId.keyId', clientId: 'bob' })
    expect(JSON.parse(tokenRequest.capability as string)).toEqual({
      'user:bob': ['subscribe'],
      'profile:home': ['subscribe'],
    })
  })
})
