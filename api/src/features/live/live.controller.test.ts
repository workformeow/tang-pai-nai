import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '@/core/error'
import { createLocalLiveProvider, createMemoryLiveProvider } from '@/core/live'
import type { LiveProvider } from '@/core/live'
import { accessTokens } from '@/core/security'
import { HttpStatus } from '@/shared/constants'
import { LiveProviderName } from '@/shared/types'
import { createLiveController } from './live.controller'
import { createMemoryLiveRepository } from './live.repository.memory'
import { createLiveRouter } from './live.routes'
import { createLiveService } from './live.service'
import type { AddressInfo } from 'node:net'

// The HTTP side of /live (docs/features/live-sync.md → Endpoints).

const buildApp = (provider: LiveProvider, stream = { heartbeatMs: 10_000, maxAgeMs: 10_000 }) => {
  const service = createLiveService({ liveRepo: createMemoryLiveRepository(), provider })
  const app = express()
  app.use('/live', createLiveRouter(createLiveController(service, stream)))
  app.use(errorHandler)
  return app
}

const bearer = async (userId = 'alice') =>
  `Bearer ${await accessTokens.sign({ sub: userId, sid: 'family-1' })}`

describe('POST /live/token', () => {
  it('answers how the device listens', async () => {
    const res = await request(buildApp(createMemoryLiveProvider(LiveProviderName.DISABLED)))
      .post('/live/token')
      .set('Authorization', await bearer())
    expect(res.status).toBe(HttpStatus.OK)
    expect(res.body).toMatchObject({ data: { provider: 'disabled' } })
  })

  it('refuses a call without a session', async () => {
    const res = await request(buildApp(createLocalLiveProvider())).post('/live/token')
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
  })
})

describe('GET /live/events', () => {
  it('answers 404 unless the provider is local', async () => {
    const res = await request(buildApp(createMemoryLiveProvider(LiveProviderName.ABLY)))
      .get('/live/events')
      .set('Authorization', await bearer())
    expect(res.status).toBe(HttpStatus.NOT_FOUND)
  })

  it("streams the user's pokes as server-sent events, then ends at its max age", async () => {
    const provider = createLocalLiveProvider()
    const server = buildApp(provider, { heartbeatMs: 10_000, maxAgeMs: 300 }).listen(0)
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/live/events`, {
        headers: { Authorization: await bearer() },
      })
      expect(response.headers.get('content-type')).toContain('text/event-stream')
      await provider.publish({ channel: 'user:alice', poke: { seq: 4, deviceId: 'phone' } })
      await provider.publish({ channel: 'user:bob', poke: { seq: 5, deviceId: 'phone' } })
      const body = await response.text()
      expect(body).toContain(
        'event: poke\ndata: {"channel":"user:alice","seq":4,"deviceId":"phone"}\n\n'
      )
      expect(body).not.toContain('user:bob')
    } finally {
      server.close()
    }
  })
})
