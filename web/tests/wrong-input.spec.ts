import { expect, test } from './support/fixtures'
import { readMail } from './support/mail'
import type { Page } from '@playwright/test'

// Step 5 (tests/README.md): what the sign-in screens say to wrong input, one case per test.

/** Asks for a code to `email` through the UI; answers the code that was mailed. */
const askForCode = async (page: Page, email: string): Promise<string> => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'อีเมล' }).fill(email)
  await page.getByRole('button', { name: 'ส่งรหัส' }).click()
  await expect(page.getByLabel('รหัส 6 หลัก')).toBeVisible()
  return (await readMail(email)).code
}

/**
 * A code that isn't `code`: its first digit moved on by `step` (1–9), so each try differs.
 * e.g. `wrongCode('123456', 1)` → `'223456'`, `wrongCode('923456', 2)` → `'123456'`
 */
const wrongCode = (code: string, step: number): string =>
  `${(Number(code[0]) + step) % 10}${code.slice(1)}`

/**
 * Types `code` (the sixth digit submits by itself) and waits for the API's answer, so a try is
 * never judged by the message the try before it left on screen.
 */
const enterCode = async (page: Page, code: string): Promise<void> => {
  const answered = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/email/verify')
  )
  await page.getByLabel('รหัส 6 หลัก').fill(code)
  await answered
}

test('refuses an email that is not an address', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'อีเมล' }).fill('not-an-email')
  await page.getByRole('button', { name: 'ส่งรหัส' }).click()

  await expect(page.getByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeVisible()
  // Nothing was sent: still on the sign-in page, no code step.
  await expect(page).toHaveURL(/\/auth\/sign-in/)
  await expect(page.getByLabel('รหัส 6 หลัก')).toBeHidden()
})

test('says a wrong code is wrong, and the right one still works', async ({ page, email }) => {
  const code = await askForCode(page, email)

  await enterCode(page, wrongCode(code, 1))
  await expect(page.getByText('รหัสไม่ถูกต้อง ลองอีกครั้ง')).toBeVisible()
  await expect(page).toHaveURL(/\/auth\//)

  await enterCode(page, code)
  await expect(page.getByText('สร้างสมุดแรก')).toBeVisible()
})

test('locks the code after 5 wrong tries, even for the right one', async ({ page, email }) => {
  const code = await askForCode(page, email)

  for (let attempt = 1; attempt <= 4; attempt++) {
    await enterCode(page, wrongCode(code, attempt))
    await expect(page.getByText('รหัสไม่ถูกต้อง ลองอีกครั้ง'), `wrong try ${attempt}`).toBeVisible()
  }
  await enterCode(page, wrongCode(code, 5))
  await expect(page.getByText('ใส่รหัสผิดหลายครั้งเกินไป กดส่งรหัสอีกครั้ง')).toBeVisible()

  await enterCode(page, code)
  await expect(page.getByText('ใส่รหัสผิดหลายครั้งเกินไป กดส่งรหัสอีกครั้ง')).toBeVisible()
  await expect(page).toHaveURL(/\/auth\//)
})
