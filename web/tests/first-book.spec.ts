import { expect, test } from './support/fixtures'

// Step 2 (tests/README.md): a signed-in user with no book creates the first one through the UI.

test('creates the first book and moves on to the first wallet', async ({ page, signIn }) => {
  await signIn()

  await page.getByRole('button', { name: 'สร้างสมุด' }).click()
  await page.getByRole('textbox', { name: 'ชื่อสมุด' }).fill('ครอบครัว')
  await page.getByRole('button', { name: 'บันทึก' }).click()

  await expect(page.getByText('สร้างสมุดแล้ว')).toBeVisible()
  // The header's switcher names the new book; the next step is the first wallet.
  await expect(page.getByRole('button', { name: 'สมุด ครอบครัว เปลี่ยนสมุด' })).toBeVisible()
  await expect(page.getByText('เพิ่มกระเป๋าเงินใบแรก')).toBeVisible()
  // The new book was queued for the server; the status settles on "sync แล้ว" once it's accepted
  // (a refused push stays on "รอ sync" / "sync ไม่สำเร็จ").
  await expect(page.getByRole('button', { name: /^สถานะ sync: sync แล้ว/ })).toBeVisible()
})
