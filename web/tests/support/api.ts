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

/** The user as the server has it (`GET /auth/me`), for a test to check what was saved. */
export const getMe = async (
  request: APIRequestContext,
  token: string
): Promise<{ displayName: string; email: string }> => {
  const response = await request.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  expect(response.ok(), `me → ${response.status()} ${text}`).toBe(true)
  return (JSON.parse(text) as { data: { displayName: string; email: string } }).data
}

/** Gives the signed-in user a password (right after sign-in counts as recent auth). */
export const setPassword = async (
  request: APIRequestContext,
  token: string,
  password: string
): Promise<void> => {
  const response = await request.put('/api/auth/password', {
    headers: { Authorization: `Bearer ${token}` },
    data: { newPassword: password, lang: 'th' },
  })
  expect(
    response.ok(),
    `fixture: set password → ${response.status()} ${await response.text()}`
  ).toBe(true)
}

/** Asks for a sign-in code to `email` without reading it: fills a code-request limit. */
export const askForCode = async (request: APIRequestContext, email: string): Promise<void> => {
  const response = await request.post('/api/auth/email/start', { data: { email, lang: 'th' } })
  expect(
    response.ok(),
    `fixture: email start → ${response.status()} ${await response.text()}`
  ).toBe(true)
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

/**
 * Reads every row of `table` the user may sync, as another device's first pull would; for a
 * test to check what reached the server.
 */
export const pullRows = async (
  request: APIRequestContext,
  token: string,
  table: string
): Promise<Record<string, unknown>[]> => {
  const deviceId = randomUUID()
  const rows: Record<string, unknown>[] = []
  let since = 0
  for (;;) {
    const response = await request.get('/api/sync/pull', {
      headers: { Authorization: `Bearer ${token}` },
      params: { since, limit: 1000, deviceId },
    })
    const text = await response.text()
    expect(response.ok(), `pull → ${response.status()} ${text}`).toBe(true)
    const { data } = JSON.parse(text) as {
      data: {
        changes: { table: string; row: Record<string, unknown> }[]
        cursor: number
        hasMore: boolean
      }
    }
    rows.push(...data.changes.filter((change) => change.table === table).map((c) => c.row))
    if (!data.hasMore) {
      return rows
    }
    since = data.cursor
  }
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

/** A category row as the category sheet saves it (category rules 2, 9): top level, open. */
export const categoryRow = (bookId: string, type: 'expense' | 'income', name: string) => {
  const now = Date.now()
  return {
    id: randomUUID(),
    bookId,
    type,
    parentId: null,
    name,
    icon: 'lucideShapes',
    color: '#475569',
    isArchived: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** A THB wallet row as the wallet sheet saves it (wallet rules 2–5); `initialBalance` in satang. */
export const walletRow = (bookId: string, name: string, initialBalance: number) => {
  const now = Date.now()
  return {
    id: randomUUID(),
    bookId,
    name,
    currencyCode: 'THB',
    initialBalance,
    icon: 'lucideWallet',
    color: '#15803d',
    excludeFromTotal: false,
    isCreditCard: false,
    isArchived: false,
    sortOrder: 0,
    hiddenCategoryIds: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
