import { expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readMail } from './mail'
import type { APIRequestContext } from '@playwright/test'

/**
 * Talks to the API the way the app does, for fixtures that set up what a test isn't about
 * (tests/README.md → "One test, one behavior"). Every failure names the fixture step, so a setup
 * failure never reads as a bug in the screen under test.
 */

/** Signs `email` up (or in) with the code from the mail; answers the access token. */
export const signUp = async (request: APIRequestContext, email: string): Promise<string> => {
  const start = await request.post('/api/auth/email/start', { data: { email, lang: 'th' } })
  expect(start.ok(), `fixture: email start → ${start.status()} ${await start.text()}`).toBe(true)
  const { code } = await readMail(email)
  const verify = await request.post('/api/auth/email/verify', { data: { email, code } })
  expect(verify.ok(), `fixture: email verify → ${verify.status()} ${await verify.text()}`).toBe(
    true
  )
  const body = (await verify.json()) as { data: { accessToken: string } }
  return body.data.accessToken
}

/** One row pushed as an upsert: what the app's outbox sends for a new row. */
export interface PushRow {
  table: string
  row: { id: string } & Record<string, unknown>
}

/** Pushes new rows from a device of its own; fails unless the server applied every one. */
export const pushRows = async (
  request: APIRequestContext,
  token: string,
  rows: PushRow[]
): Promise<void> => {
  const response = await request.post('/api/sync/push', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      deviceId: randomUUID(),
      ops: rows.map(({ table, row }) => ({
        opId: randomUUID(),
        table,
        op: 'upsert',
        row,
        baseSeq: null,
      })),
    },
  })
  const text = await response.text()
  expect(response.ok(), `fixture: push → ${response.status()} ${text}`).toBe(true)
  const { data } = JSON.parse(text) as { data: { results: { status: string }[] } }
  const refused = data.results.filter((result) => result.status !== 'applied')
  expect(refused, `fixture: push not applied: ${JSON.stringify(refused)}`).toEqual([])
}

/** A book row as the book sheet saves it (book rules 2–3). */
export const bookRow = (name: string) => {
  const now = Date.now()
  return {
    id: randomUUID(),
    name,
    icon: 'lucideHouse',
    color: '#1d4ed8',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
