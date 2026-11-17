import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { toastState } from '@spartan-ng/brain/sonner'
import { AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import th from '@/core/i18n/th.json'
import { NetworkStatusService } from '@/core/network'
import { findOp, listOps, OfflineService, putRow, queueWrite, SyncService } from '@/core/offline'
import type { LocalDatabase } from '@/core/offline'
import { openTestDatabase } from '@/core/offline/testing-db'
import { WalletService } from '@/core/wallet'
import { WalletSheet } from './wallet-sheet'

describe('WalletSheet', () => {
  let fixture: ComponentFixture<WalletSheet>
  let db: LocalDatabase
  let wallets: WalletService
  const changes = signal(0)
  const trusted = signal(true)
  const online = signal(true)

  const offline = {
    isOpen: signal(true),
    sharedActive: signal(false),
    leaveShared: () => undefined,
    isTrusted: trusted,
    meta: signal(null),
    changes,
    db: () => db,
    write: <T>(work: (database: LocalDatabase) => T): T => {
      const result = db.transaction(work)
      changes.update((n) => n + 1)
      return result
    },
  }
  const sync = {
    canSync: signal(false),
    isSyncing: signal(false),
    lastSyncedAt: signal<number | null>(1),
    rejectedOp: (opId: string) => findOp(db, opId),
  }

  const body = () => document.body
  const text = () => body().textContent
  /** A button by its text, or by its aria-label for an icon button. */
  const button = (label: string) =>
    [...body().querySelectorAll('button')].find(
      (b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label
    )
  /** The input a (screen-reader) label names. */
  const input = (label: string) => {
    const id = [...body().querySelectorAll('label')].find(
      (l) => l.textContent.trim() === label
    )?.htmlFor
    return body().querySelector(`input[id="${id}"]`) as HTMLInputElement
  }
  const type = async (label: string, value: string) => {
    const field = input(label)
    field.value = value
    field.dispatchEvent(new Event('input'))
    field.dispatchEvent(new Event('blur'))
    await settle()
  }
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }
  const click = async (label: string) => {
    button(label)?.click()
    await settle()
  }
  const submit = async () => {
    body().querySelector('form')?.dispatchEvent(new Event('submit'))
    await settle()
  }
  const radio = async (label: string) => {
    ;(body().querySelector(`input[aria-label="${label}"]`) as HTMLInputElement).click()
    await settle()
  }
  const wallet = (id: string, extra: object = {}) => {
    putRow(db, 'wallets', {
      id,
      bookId: 'p1',
      name: id,
      currencyCode: 'THB',
      initialBalance: 0,
      icon: 'lucideWallet',
      color: '#16a34a',
      excludeFromTotal: false,
      isArchived: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 5,
      updatedBy: 'u1',
      ...extra,
    })
    changes.update((n) => n + 1)
  }
  const category = (id: string, extra: object = {}) => {
    putRow(db, 'categories', {
      id,
      bookId: 'p1',
      type: 'expense',
      parentId: null,
      name: id,
      icon: 'lucideShapes',
      color: '#475569',
      isArchived: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 5,
      updatedBy: 'u1',
      ...extra,
    })
    changes.update((n) => n + 1)
  }
  /** A row switch of app-toggle-list-field, by the name it shows. */
  const toggle = (name: string) =>
    [...body().querySelectorAll('button[role="switch"]')].find((b) =>
      b.textContent.trim().startsWith(name)
    ) as HTMLButtonElement
  /** The form's switches in order: credit card, then excluded from the total. */
  const switches = () => [...body().querySelectorAll<HTMLButtonElement>('button[role="switch"]')]
  /** A row of the form that opens a view, by its label. */
  const row = (label: string) =>
    [...body().querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(label))
  const currency = (code: string, minorUnit: number, isActive: boolean, sortOrder: number) =>
    putRow(db, 'currencies', {
      code,
      minorUnit,
      isActive,
      sortOrder,
      createdAt: 1,
      updatedAt: 1,
      changeSeq: 1,
    })

  beforeEach(async () => {
    db = await openTestDatabase()
    localStorage.clear()
    trusted.set(true)
    online.set(true)
    toastState.dismiss()
    putRow(db, 'books', {
      id: 'p1',
      name: 'Home',
      icon: 'lucideHouse',
      color: '#16a34a',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 1,
      updatedBy: 'u1',
    })
    currency('THB', 2, true, 0)
    currency('JPY', 0, false, 3)
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: OfflineService, useValue: offline },
        { provide: SyncService, useValue: sync },
        {
          provide: NetworkStatusService,
          useValue: { isOnline: online, serverReachable: signal(true) },
        },
      ],
    })
    TestBed.inject(AuthStore).user.set({ id: 'u1' } as AuthUser)
    wallets = TestBed.inject(WalletService)
    fixture = TestBed.createComponent(WalletSheet)
    changes.update((n) => n + 1)
    await settle()
  })

  afterEach(() => {
    fixture.destroy()
    db.close()
    // The sheet's toasts are module state; don't leave them to the next spec file.
    toastState.dismiss()
  })

  it('creates a wallet: name, a negative balance, an icon and colour from their view, excluded', async () => {
    wallets.open({ mode: 'create' })
    await settle()
    expect(text()).toContain(th.wallets.createHeading)
    expect(text()).toContain('THB')
    // One currency is active, so there is no picker (rule 4).
    expect(body().querySelector('select')).toBeNull()
    await type(th.wallets.name, '  บัตรเครดิต ')
    await type(th.wallets.initialBalance, '18,250.75')
    await click(th.form.negativeAmount)
    expect(button(th.form.negativeAmount)?.getAttribute('aria-pressed')).toBe('true')
    await click(th.wallets.changeIcon)
    expect(text()).toContain(th.wallets.iconHeading)
    await radio('สีที่ 7')
    await radio(th.icons.tpnCardChip)
    // Picking only selects: the view stays until ‹.
    expect(text()).toContain(th.wallets.iconHeading)
    await click(th.sheet.back)
    expect(input(th.wallets.name).value).toBe('  บัตรเครดิต ')
    switches()[1].click()
    await settle()
    await submit()
    expect(wallets.wallets()).toMatchObject([
      {
        name: 'บัตรเครดิต',
        initialBalance: -1825075,
        icon: 'tpnCardChip',
        color: '#dc2626',
        currencyCode: 'THB',
        excludeFromTotal: true,
      },
    ])
    expect(wallets.sheet()).toBeNull()
    expect(toastState.toasts().map((toast) => toast.title)).toEqual([th.wallets.created])
  })

  it('locks "excluded from the total" on while the wallet is a credit card (credit-card rule 2)', async () => {
    wallets.open({ mode: 'create' })
    await settle()
    await type(th.wallets.name, 'Visa')
    const [card, excluded] = switches()
    expect(excluded.disabled).toBe(false)
    card.click()
    await settle()
    expect(switches()[1].getAttribute('aria-checked')).toBe('true')
    expect(switches()[1].disabled).toBe(true)
    expect(text()).toContain(th.wallets.creditCardExcluded)
    switches()[0].click()
    await settle()
    expect(switches()[1].disabled).toBe(false)
    expect(text()).not.toContain(th.wallets.creditCardExcluded)
    switches()[0].click()
    await settle()
    await submit()
    expect(wallets.wallets()).toMatchObject([
      { name: 'Visa', isCreditCard: true, excludeFromTotal: true },
    ])
  })

  it('opens a card with the switch on and "excluded" locked', async () => {
    wallet('w1', { name: 'Visa', isCreditCard: true, excludeFromTotal: true })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    expect(switches()[0].getAttribute('aria-checked')).toBe('true')
    expect(switches()[1].disabled).toBe(true)
  })

  it('hides categories from their view: a parent locks its children, the row counts them (category rule 13)', async () => {
    category('Food')
    category('Coffee', { parentId: 'Food' })
    category('Tea', { parentId: 'Food', sortOrder: 1 })
    category('Taxi')
    category('Salary', { type: 'income' })
    wallet('w1', { hiddenCategoryIds: ['Tea', 'unknown'] })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    expect(row(th.wallets.categoriesUsed)?.textContent).toContain('ซ่อน 1')
    row(th.wallets.categoriesUsed)?.click()
    await settle()
    expect(text()).toContain(th.categories.expense)
    expect(toggle('Tea').getAttribute('aria-checked')).toBe('false')
    toggle('Food').click()
    await settle()
    expect(toggle('Coffee').disabled).toBe(true)
    expect(toggle('Coffee').getAttribute('aria-checked')).toBe('false')
    expect(toggle('Coffee').textContent).toContain(th.categories.hiddenWithParent)
    ;[...body().querySelectorAll('button[role="tab"]')]
      .find((b) => b.textContent.trim() === th.categories.income)
      ?.dispatchEvent(new Event('click'))
    await settle()
    toggle('Salary').click()
    await settle()
    await click(th.sheet.back)
    expect(row(th.wallets.categoriesUsed)?.textContent).toContain('ซ่อน 4')
    await submit()
    expect(wallets.byId('w1')?.hiddenCategoryIds).toEqual(['Tea', 'unknown', 'Food', 'Salary'])
    expect(listOps(db, 'pending')[0].row['hiddenCategoryIds']).toEqual([
      'Tea',
      'unknown',
      'Food',
      'Salary',
    ])
  })

  it('starts a new wallet with all categories in use, and keeps the choice made', async () => {
    category('Taxi')
    wallets.open({ mode: 'create' })
    await settle()
    expect(row(th.wallets.categoriesUsed)?.textContent).toContain(th.wallets.categoriesAll)
    row(th.wallets.categoriesUsed)?.click()
    await settle()
    toggle('Taxi').click()
    await settle()
    await click(th.sheet.back)
    await type(th.wallets.name, 'บัตร')
    await submit()
    expect(wallets.wallets()[0].hiddenCategoryIds).toEqual(['Taxi'])
  })

  it('starts a new wallet with the default icon, colour and an empty balance (rule 8)', async () => {
    wallets.open({ mode: 'create' })
    await settle()
    await type(th.wallets.name, 'เงินสด')
    await submit()
    expect(wallets.wallets()).toMatchObject([
      { icon: 'lucideWallet', color: '#2563eb', initialBalance: 0, excludeFromTotal: false },
    ])
  })

  it('refuses an empty name, a taken one, and a balance it cannot read, in place', async () => {
    wallet('w1', { name: 'Cash' })
    wallets.open({ mode: 'create' })
    await settle()
    await submit()
    expect(text()).toContain(th.wallets.nameRequired)
    await type(th.wallets.name, 'CASH')
    expect(text()).toContain(th.wallets.nameTaken)
    await type(th.wallets.name, 'Bank')
    await type(th.wallets.initialBalance, '12.345')
    expect(text()).toContain(th.wallets.balanceDecimals)
    await type(th.wallets.initialBalance, 'abc')
    expect(text()).toContain(th.wallets.balanceFormat)
    await type(th.wallets.initialBalance, '10000000000000.01')
    expect(text()).toContain(th.wallets.balanceTooBig)
    await submit()
    expect(listOps(db, 'pending')).toHaveLength(0)
  })

  describe('currency (currency.md → Web screens)', () => {
    const chipPrefix = th.wallets.currencyPick.split('{{')[0]
    /** The form's currency chip, labelled "สกุลเงิน: <name>". */
    const chip = () =>
      [...body().querySelectorAll('button')].find((b) =>
        b.getAttribute('aria-label')?.startsWith(chipPrefix)
      )
    /** The picker's flags, by code. */
    const flags = () =>
      [...body().querySelectorAll<HTMLButtonElement>('app-currency-pick button')].map((b) => ({
        code: b.textContent.trim(),
        pressed: b.getAttribute('aria-pressed'),
        label: b.getAttribute('aria-label'),
      }))
    const pick = async (code: string) => {
      ;[...body().querySelectorAll<HTMLButtonElement>('app-currency-pick button')]
        .find((b) => b.textContent.trim() === code)
        ?.click()
      await settle()
    }
    const groups = () =>
      [...body().querySelectorAll('app-currency-pick p')].map((p) => p.textContent.trim())

    it('shows the chip with one active currency, and picks from a flag grid; decimals follow', async () => {
      wallets.open({ mode: 'create' })
      await settle()
      expect(chip()?.textContent).toContain('THB')
      currency('JPY', 0, true, 3)
      changes.update((n) => n + 1)
      await type(th.wallets.name, 'เยน')
      await type(th.wallets.initialBalance, '15000.5')
      chip()?.click()
      await settle()
      expect(text()).toContain(th.wallets.currency)
      expect(groups()).toEqual([th.currencyGroups.asia])
      expect(flags()).toMatchObject([
        { code: 'THB', pressed: 'true' },
        { code: 'JPY', pressed: 'false', label: 'เยนญี่ปุ่น' },
      ])
      await pick('JPY')
      // Back on the form at once, the balance now checked against 0 digits.
      expect(body().querySelector('app-currency-pick')).toBeNull()
      expect(chip()?.textContent).toContain('JPY')
      expect(text()).toContain(th.wallets.balanceDecimals)
      await type(th.wallets.initialBalance, '15,000')
      await submit()
      expect(wallets.wallets()).toMatchObject([{ currencyCode: 'JPY', initialBalance: 15000 }])
    })

    it("offers only active currencies, the book's own first; an unknown one under อื่น ๆ", async () => {
      currency('KRW', 0, true, 2)
      currency('XAU', 2, true, 9)
      wallet('w1', { currencyCode: 'KRW' })
      wallets.open({ mode: 'create' })
      await settle()
      chip()?.click()
      await settle()
      expect(groups()).toEqual([
        th.currencyGroups.inBook,
        th.currencyGroups.asia,
        th.currencyGroups.other,
      ])
      expect(flags().map((flag) => flag.code)).toEqual(['KRW', 'THB', 'KRW', 'XAU'])
    })

    it('shows a wallet with transactions its currency as text, with the reason (wallet rule 4)', async () => {
      wallet('w1', { name: 'Card' })
      putRow(db, 'transactions', {
        id: 't1',
        bookId: 'p1',
        walletId: 'w1',
        categoryId: 'c',
        amount: 1000,
        occurredOn: '2026-11-02',
        note: '',
        excludeFromReport: false,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        changeSeq: 1,
        updatedBy: 'u1',
      })
      changes.update((n) => n + 1)
      wallets.open({ mode: 'edit', id: 'w1' })
      await settle()
      expect(chip()).toBeUndefined()
      expect(text()).toContain(th.wallets.currencyLocked)
    })
  })

  it('edits a wallet with its balance grouped and its sign, keeping its own name free', async () => {
    wallet('w1', { name: 'Card', initialBalance: -1825075 })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    expect(text()).toContain(th.wallets.editHeading)
    expect(input(th.wallets.initialBalance).value).toBe('18,250.75')
    expect(button(th.form.negativeAmount)?.getAttribute('aria-pressed')).toBe('true')
    await submit()
    expect(listOps(db, 'pending')).toMatchObject([{ rowId: 'w1', baseSeq: 5 }])
  })

  it('archives from the header at once, and undoes it from the toast (rule 6)', async () => {
    wallet('w1', { name: 'Card' })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    await click(th.wallets.archive)
    expect(wallets.byId('w1')?.isArchived).toBe(true)
    expect(wallets.sheet()).toBeNull()
    const [shown] = toastState.toasts()
    expect(shown.title).toBe('เก็บ “Card” ถาวรแล้ว')
    const action = shown.action as { label: string; onClick: () => void }
    expect(action.label).toBe(th.wallets.undo)
    action.onClick()
    expect(wallets.byId('w1')?.isArchived).toBe(false)
  })

  it('says why an archived wallet cannot come back, and lets its name be edited', async () => {
    wallet('w1', { name: 'Card', isArchived: true })
    wallet('w2', { name: 'card' })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    // An archived wallet holds no name (rule 3).
    expect(text()).not.toContain(th.wallets.nameTaken)
    await click(th.wallets.unarchive)
    expect(text()).toContain(th.wallets.unarchiveNameTaken)
    expect(wallets.byId('w1')?.isArchived).toBe(true)
    await type(th.wallets.name, 'Card 2')
    expect(text()).not.toContain(th.wallets.unarchiveNameTaken)
  })

  it('deletes only after the confirm view, which can go back', async () => {
    wallet('w1', { name: 'Card' })
    wallets.open({ mode: 'edit', id: 'w1' })
    await settle()
    await click(th.wallets.delete)
    expect(text()).toContain('ลบกระเป๋าเงิน “Card” ใช่ไหม')
    await click(th.sheet.back)
    expect(wallets.byId('w1')).not.toBeNull()
    await click(th.wallets.delete)
    await click(th.wallets.deleteConfirm)
    expect(wallets.byId('w1')).toBeNull()
    expect(listOps(db, 'pending')).toMatchObject([{ rowId: 'w1', op: 'delete' }])
  })

  it('slides a deeper view in from the right and the form back in from the left', async () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    HTMLElement.prototype.animate = animate
    try {
      wallet('w1', { name: 'Card' })
      wallets.open({ mode: 'edit', id: 'w1' })
      await settle()
      expect(animate).not.toHaveBeenCalled()
      await click(th.wallets.delete)
      expect(animate).toHaveBeenLastCalledWith(
        [{ opacity: 0, transform: 'translateX(48px)' }, expect.objectContaining({ opacity: 1 })],
        expect.anything()
      )
      await click(th.sheet.back)
      expect(animate).toHaveBeenLastCalledWith(
        [{ opacity: 0, transform: 'translateX(-48px)' }, expect.objectContaining({ opacity: 1 })],
        expect.anything()
      )
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('closes at once with unsaved input, without asking', async () => {
    wallets.open({ mode: 'create' })
    await settle()
    await type(th.wallets.name, 'เงินสด')
    await click(th.sheet.close)
    expect(wallets.sheet()).toBeNull()
    expect(wallets.wallets()).toHaveLength(0)
  })

  it('opens a fix with the refused values and their error, and saves it in place of the op', async () => {
    wallet('w1', { name: 'Cash' })
    db.transaction((tx) =>
      queueWrite(tx, 'wallets', 'upsert', {
        id: 'w9',
        bookId: 'p1',
        name: 'cash',
        currencyCode: 'THB',
        initialBalance: 100,
        icon: 'tpnBahtNote',
        color: '#2563eb',
        excludeFromTotal: false,
        isArchived: false,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
      })
    )
    db.exec(
      `UPDATE outbox SET status = 'rejected', code = 'CONFLICT'; DELETE FROM wallets WHERE id = 'w9'`
    )
    const opId = listOps(db, 'rejected')[0].opId
    wallets.openFix(opId)
    await settle()
    expect(text()).toContain(th.wallets.fixHeading)
    expect(input(th.wallets.initialBalance).value).toBe('1')
    expect(text()).toContain(th.wallets.nameTaken)
    await type(th.wallets.name, 'Cash 2')
    await submit()
    expect(listOps(db, 'rejected')).toHaveLength(0)
    expect(wallets.byId('w9')).toMatchObject({ name: 'Cash 2', icon: 'tpnBahtNote' })
  })

  it('says an untrusted device must be online, and blocks saving', async () => {
    trusted.set(false)
    online.set(false)
    wallets.open({ mode: 'create' })
    await settle()
    expect(text()).toContain(th.wallets.needsOnline)
    expect(button(th.wallets.save)?.disabled).toBe(true)
  })
})
