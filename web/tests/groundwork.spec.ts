import { expect, test } from './support/fixtures'

// Step 0 (tests/README.md): the pieces every other test stands on.

test('signs a new user in through the API with the code from the mail', async ({
  page,
  signIn,
}) => {
  await signIn()
  // A new user signed in lands on the first-book step (signed out would be /auth/sign-in).
  await expect(page.getByText('สร้างสมุดแรก')).toBeVisible()
  await expect(page).not.toHaveURL(/\/auth\//)
})

test("keeps each test's rate limits apart by its client IP", async ({ page, email, clientIp }) => {
  const verify = async (ip: string) =>
    page.request.post('/api/auth/email/verify', {
      data: { email, code: '000000' },
      headers: { 'X-Forwarded-For': ip },
    })
  // VERIFIES_PER_IP: 30 per 15 minutes, counted before the code is checked.
  for (let i = 0; i < 30; i++) {
    expect((await verify(clientIp)).status()).not.toBe(429)
  }
  expect((await verify(clientIp)).status()).toBe(429)
  expect((await verify('10.255.255.254')).status()).not.toBe(429)
})
