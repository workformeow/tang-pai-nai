import { expect, test } from './support/fixtures'
import { readMail } from './support/mail'

// Step 1 (tests/README.md): a new person signs up through the UI with the code from the mail.

test('signs up with the email code and lands signed in', async ({ page, email }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/auth\/sign-in/)

  await page.getByRole('textbox', { name: 'อีเมล' }).fill(email)
  await page.getByRole('button', { name: 'ส่งรหัส' }).click()

  await expect(page.getByText(email)).toBeVisible()
  const { code } = await readMail(email)
  // The sixth digit submits by itself (no tap on เข้าสู่ระบบ).
  await page.getByLabel('รหัส 6 หลัก').fill(code)

  // A new user has no book yet: the app opens on the first-book step.
  await expect(page.getByText('สร้างสมุดแรก')).toBeVisible()
  await expect(page).not.toHaveURL(/\/auth\//)
})
