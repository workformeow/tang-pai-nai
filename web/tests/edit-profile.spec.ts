import { getMe } from './support/api'
import { expect, test } from './support/fixtures'

// Step 7 (tests/README.md): a signed-in user changes the display name from the Account tab.

test('changes the display name, kept after a reload and on the server', async ({
  page,
  signIn,
  email,
}) => {
  const token = await signIn()
  await page.goto('/account')
  // The card's name is its own line (exact text), apart from the email under it.
  const profile = page.getByRole('button', { name: 'แก้ไขโปรไฟล์' })
  const shownName = (name: string) => profile.getByText(name, { exact: true })
  // A new user is named after the email's local part.
  await expect(shownName(email.split('@')[0])).toBeVisible()

  await profile.click()
  await page.getByRole('textbox', { name: 'ชื่อที่แสดง' }).fill('แม่บ้าน')
  await page.getByRole('button', { name: 'บันทึก' }).click()

  await expect(page.getByText('บันทึกแล้ว')).toBeVisible()
  await expect(shownName('แม่บ้าน')).toBeVisible()
  await expect(profile.getByText(email, { exact: true })).toBeVisible()

  await page.reload()
  await expect(shownName('แม่บ้าน')).toBeVisible()
  // The device keeps the name too, so the reload alone doesn't prove the server has it.
  expect(await getMe(page.request, token)).toMatchObject({ displayName: 'แม่บ้าน', email })
})
