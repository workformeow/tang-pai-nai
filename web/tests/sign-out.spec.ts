import { expect, test } from './support/fixtures'
import type { Page } from '@playwright/test'

// Step 8 (tests/README.md): signing out from the Account tab ends on the sign-in page, and the
// device forgets the user's data (offline-sync rule 7). The `tpn-book:` keys it also removes
// are only written once a choice is made, so they are left to offline.service.spec.ts.

/** Whether this device holds a vault (IndexedDB `tpn-vault`: the user's encrypted database). */
const hasVault = async (page: Page) =>
  page.evaluate(async () => (await indexedDB.databases()).some((db) => db.name === 'tpn-vault'))

test('signs out to the sign-in page and wipes the data on this device', async ({
  page,
  // A user with data on the device: a book and a wallet, pulled and saved in the vault.
  withWallet: _,
}) => {
  await test.step('the device holds the data before', async () => {
    // The vault is saved after the first pull; wait for it, so the check after means something.
    await expect.poll(async () => hasVault(page)).toBe(true)
  })

  await test.step('sign out from the Account tab', async () => {
    await page.goto('/account')
    await page.getByRole('button', { name: 'ออกจากระบบ' }).click()
    const sheet = page.getByRole('dialog')
    await expect(
      sheet.getByText('ข้อมูลในอุปกรณ์นี้จะถูกลบเพื่อความเป็นส่วนตัว', { exact: false })
    ).toBeVisible()
    await sheet.getByRole('button', { name: 'ออกจากระบบ' }).click()
  })

  await test.step('on the sign-in page, nothing left on the device', async () => {
    await expect(page).toHaveURL(/\/auth\/sign-in/)
    await expect(page.getByRole('textbox', { name: 'อีเมล' })).toBeVisible()
    // Polled: WebKit's `indexedDB.databases()` can still list a database just deleted. A vault
    // written again after the wipe would stay, and fail this.
    await expect.poll(async () => hasVault(page)).toBe(false)
  })

  await test.step('still signed out after a reload: the session ended on the server', async () => {
    await page.reload()
    await expect(page).toHaveURL(/\/auth\/sign-in/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth\/sign-in/)
    await expect(page.getByRole('textbox', { name: 'อีเมล' })).toBeVisible()
    // An expired session keeps the data and says whose it is (`auth.localData`); a sign-out doesn't.
    await expect(page.getByText(/^เครื่องนี้มีข้อมูลของ/)).toBeHidden()
  })
})
