import { randomUUID } from 'node:crypto'
import { askForCode, setPassword, signUp } from './support/api'
import { expect, test } from './support/fixtures'

// Step 6 (tests/README.md): what the sign-in screens say once a limit is full, one limit per
// test. Each test has its own email and client IP, so filling a limit here blocks no other test.

/** The limit's message, the wait in minutes (`waitMessage` in core/auth/auth-error.ts). */
const WAIT = /ลองบ่อยเกินไป รออีก \d+ นาทีแล้วลองใหม่/

test('stops password sign-in after 5 wrong passwords, even the right one', async ({
  page,
  request,
  email,
}) => {
  // A user with a password, signed up through `request` so the page stays signed out. The
  // policy wants a lowercase and an uppercase letter, a digit and a symbol.
  const password = `E2e-${randomUUID()}`
  await setPassword(request, await signUp(request, email), password)

  await page.goto('/auth/sign-in?with=password')
  await page.getByRole('textbox', { name: 'อีเมล' }).fill(email)
  const field = page.getByRole('textbox', { name: 'รหัสผ่าน' })
  const signIn = async (text: string) => {
    // Wait for the API's answer, so a try is never judged by the message of the one before.
    const answered = page.waitForResponse((r) => r.url().endsWith('/api/auth/password/sign-in'))
    await field.fill(text)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
    await answered
  }

  // PASSWORD_FAILURES_PER_EMAIL: 5 wrong tries are told apart from the limit.
  for (let attempt = 1; attempt <= 5; attempt++) {
    await signIn(`wrong-${attempt}-${password}`)
    await expect(
      page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง'),
      `wrong try ${attempt}`
    ).toBeVisible()
  }
  await signIn(password)
  await expect(page.getByRole('alert').filter({ hasText: WAIT })).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/sign-in/)
})

test('stops code requests from one client after 20 in an hour', async ({
  page,
  request,
  email,
}) => {
  // STARTS_PER_IP: 20 requests for other emails from this test's IP fill it…
  await Promise.all(
    Array.from({ length: 20 }, async () => askForCode(request, `e2e-${randomUUID()}@example.test`))
  )

  // …so the 21st, from the screen, is refused with the wait, and no code step opens.
  await page.goto('/')
  await page.getByRole('textbox', { name: 'อีเมล' }).fill(email)
  await page.getByRole('button', { name: 'ส่งรหัส' }).click()
  await expect(page.getByRole('alert').filter({ hasText: WAIT })).toBeVisible()
  await expect(page.getByLabel('รหัส 6 หลัก')).toBeHidden()
})
