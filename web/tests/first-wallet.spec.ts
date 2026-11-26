import { expect, test } from './support/fixtures'

// Step 3 (tests/README.md): a user with a book (given by the API) creates the first wallet in it.

test('creates the first wallet in the book', async ({ page, withBook }) => {
  await expect(page.getByText('เพิ่มกระเป๋าเงินใบแรก')).toBeVisible()

  await page.getByRole('button', { name: 'เพิ่มกระเป๋าเงิน' }).click()
  await page.getByRole('textbox', { name: 'ชื่อกระเป๋าเงิน' }).fill('เงินสด')
  await page.getByRole('textbox', { name: 'ยอดเงินเริ่มต้น' }).fill('1500')
  await page.getByRole('button', { name: 'บันทึก' }).click()

  await expect(page.getByText('เพิ่มกระเป๋าเงินแล้ว')).toBeVisible()
  // The Transactions tab opens in place of the first-wallet step, its total = the start balance.
  await expect(page.getByText('ยอดรวม ฿1,500.00')).toBeVisible()
  await expect(
    page.getByRole('button', { name: `สมุด ${withBook.name} เปลี่ยนสมุด` })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^สถานะ sync: sync แล้ว/ })).toBeVisible()

  // The Wallets tab lists it.
  await page
    .getByRole('navigation', { name: 'เมนูหลัก' })
    .getByRole('link', { name: 'กระเป๋า' })
    .click()
  await expect(page.getByText('เงินสด')).toBeVisible()
})
