import { pullRows } from './support/api'
import { expect, test } from './support/fixtures'

// Step 4 (tests/README.md): a user with a wallet (given by the API) adds an expense; it is on
// the list, still there after a reload, and on the server.

test('adds an expense that stays after a reload and reaches the server', async ({
  page,
  withWallet,
}) => {
  const { category, wallet } = withWallet
  const row = page.getByRole('button', { name: `${category.name} ${wallet.name} -250.00` })

  await test.step('add 250 in อาหาร', async () => {
    await page
      .getByRole('navigation', { name: 'เมนูหลัก' })
      .getByRole('button', { name: 'เพิ่มธุรกรรม' })
      .click()
    // Tap the amount row for its keypad. It opens with the sheet in Chromium, but on iPhone
    // (WebKit) the drawer's first focus lands on the date field and closes it (tests/README.md,
    // step 4 notes).
    await page.getByRole('button', { name: /^จำนวนเงิน/ }).click()
    const keypad = page.getByRole('group', { name: 'แป้นตัวเลข' })
    for (const key of ['2', '5', '0']) {
      await keypad.getByRole('button', { name: key, exact: true }).click()
    }
    await expect(page.getByRole('button', { name: 'จำนวนเงิน 250' })).toBeVisible()
    await page.getByRole('button', { name: /^หมวดหมู่/ }).click()
    await page.getByRole('button', { name: category.name }).click()
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  })

  await test.step('on the list, the total down, synced', async () => {
    // A plain save shows no toast: the row on the list is the feedback.
    await expect(row).toBeVisible()
    await expect(page.getByText('ยอดรวม ฿750.00')).toBeVisible()
    await expect(page.getByRole('button', { name: /^สถานะ sync: sync แล้ว/ })).toBeVisible()
  })

  await test.step('still there after a reload', async () => {
    await page.reload()
    await expect(row).toBeVisible()
    await expect(page.getByText('ยอดรวม ฿750.00')).toBeVisible()
  })

  await test.step('on the server, as another device pulls it', async () => {
    const rows = await pullRows(page.request, withWallet.token, 'transactions')
    expect(rows).toEqual([
      expect.objectContaining({
        walletId: wallet.id,
        categoryId: category.id,
        amount: 25_000,
        deletedAt: null,
      }),
    ])
  })
})
