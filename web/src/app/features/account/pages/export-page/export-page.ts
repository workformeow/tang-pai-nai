import { DOCUMENT } from '@angular/common'
import { Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideArrowLeftRight, lucideCalendar, lucideDownload } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSwitch } from '@spartan-ng/helm/switch'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { OfflineService } from '@/core/offline'
import { WalletService } from '@/core/wallet'
import { WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { CustomRangeSheet } from '@/shared/components/period'
import type { DaySpan } from '@/shared/components/period'
import { fromDay, toDay } from '@/shared/utils'
import { exportFileName } from './csv'
import {
  categoryChoices,
  dataSpan,
  exportCount,
  exportCsv,
  exportRows,
  walletChoices,
} from './export-data'
import { ExportPickSheet } from './export-pick-sheet'
import type { ExportQuery, PickRow } from './export-data'
import type { PickTab } from './export-pick-sheet'

type Mode = 'all' | 'some'

/**
 * Account › ส่งออก CSV (docs/features/export.md rules 1–6, mock-up frames 2–3 and 8): the current
 * book's rows as one CSV file, built on the device, so it works offline.
 */
@Component({
  selector: 'app-export-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSwitch, CustomRangeSheet, ExportPickSheet],
  providers: [provideIcons({ lucideArrowLeftRight, lucideCalendar, lucideDownload })],
  templateUrl: './export-page.html',
})
export class ExportPage {
  private document = inject(DOCUMENT)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  private offlineService = inject(OfflineService)
  private bookService = inject(BookService)
  private walletService = inject(WalletService)

  protected readonly walletIcon = WALLET_DEFAULT_ICON
  protected readonly categoryIcon = CATEGORY_DEFAULT_ICON

  protected dateMode = signal<Mode>('all')
  protected custom = signal<DaySpan | null>(null)
  protected walletMode = signal<Mode>('all')
  protected walletIds = signal<string[]>([])
  protected categoryMode = signal<Mode>('all')
  protected categoryIds = signal<string[]>([])
  protected others = signal(true)
  protected rangeOpen = signal(false)
  protected pickerKey = signal<'wallets' | 'categories' | null>(null)
  protected isProcessing = signal(false)

  protected bookName = computed(() => this.bookService.current()?.name ?? '')

  /** Reads re-run on every local write or pull (`changes()`), as other screens do. */
  private read<T>(work: (db: ReturnType<OfflineService['db']>) => T, fallback: T): T {
    this.offlineService.changes()
    return this.offlineService.isOpen() ? work(this.offlineService.db()) : fallback
  }

  private bookId = computed(() => this.bookService.current()?.id ?? '')
  private wallets = computed(() => this.read((db) => walletChoices(db, this.bookId()), []))
  private categories = computed(() =>
    this.read(
      (db) => ({
        expense: categoryChoices(db, this.bookId(), 'expense'),
        income: categoryChoices(db, this.bookId(), 'income'),
      }),
      { expense: [] as PickRow[], income: [] as PickRow[] }
    )
  )
  private span = computed(() => this.read((db) => dataSpan(db, this.bookId()), null))

  private query = computed<ExportQuery>(() => {
    const custom = this.dateMode() === 'some' ? this.custom() : null
    return {
      bookId: this.bookId(),
      from: custom?.from ?? null,
      to: custom?.to ?? null,
      walletIds: this.walletMode() === 'some' ? this.walletIds() : null,
      categoryIds: this.categoryMode() === 'some' ? this.categoryIds() : null,
      others: this.others(),
    }
  })

  protected count = computed(() => {
    const query = this.query()
    return this.read((db) => exportCount(db, query), 0)
  })

  private dateFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.languageService.locale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
  )

  private formatSpan(from: string, to: string): string {
    const format = this.dateFormat()
    return `${format.format(fromDay(from))} – ${format.format(fromDay(to))}`
  }

  protected spanText = computed(() => {
    const span = this.span()
    return span ? this.formatSpan(span.from, span.to) : ''
  })

  protected customText = computed(() => {
    const custom = this.custom()
    return custom?.from && custom.to ? this.formatSpan(custom.from, custom.to) : ''
  })

  protected countText = computed(() =>
    new Intl.NumberFormat(this.languageService.locale()).format(this.count())
  )

  protected groups = computed(() => {
    this.languageService.language()
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    const counted = (key: string, count: number) =>
      t(`export.${key}${count === 1 ? 'One' : ''}`, { count })
    const wallets = this.wallets()
    const chosenWallets = new Set(this.walletIds())
    const walletChips = wallets.filter((w) => chosenWallets.has(w.id)).map((w) => w.name)
    const { expense, income } = this.categories()
    const chosen = new Set(this.categoryIds())
    const categoryChips: string[] = []
    const types: string[] = []
    for (const [type, rows] of [
      ['expense', expense],
      ['income', income],
    ] as const) {
      const before = categoryChips.length
      for (const row of rows) {
        const children = row.children.filter((child) => chosen.has(child.id))
        if (chosen.has(row.id) && children.length === row.children.length) {
          categoryChips.push(
            row.children.length > 0
              ? t('export.withChildren', { name: row.name, count: row.children.length })
              : row.name
          )
          continue
        }
        if (chosen.has(row.id)) {
          categoryChips.push(row.name)
        }
        categoryChips.push(...children.map((child) => child.name))
      }
      if (categoryChips.length > before) {
        types.push(t(`export.kind.${type}`))
      }
    }
    return [
      {
        key: 'wallets' as const,
        heading: 'export.wallets',
        allLabel: 'export.allWallets',
        allHint: counted('allWalletsHint', wallets.length),
        someLabel: 'export.someWallets',
        mode: this.walletMode(),
        chips: walletChips,
        summary: counted('walletCount', walletChips.length),
      },
      {
        key: 'categories' as const,
        heading: 'export.categories',
        allLabel: 'export.allCategories',
        allHint: '',
        someLabel: 'export.someCategories',
        mode: this.categoryMode(),
        chips: categoryChips,
        summary: [counted('categoryCount', chosen.size), ...types].join(' · '),
      },
    ]
  })

  protected pickerTabs = computed<PickTab[]>(() => {
    this.languageService.language()
    if (this.pickerKey() === 'wallets') {
      return [{ key: 'wallets', label: '', rows: this.wallets() }]
    }
    const { expense, income } = this.categories()
    return [
      { key: 'expense', label: this.transloco.translate('export.kind.expense'), rows: expense },
      { key: 'income', label: this.transloco.translate('export.kind.income'), rows: income },
    ]
  })

  protected chooseCustom(): void {
    this.dateMode.set('some')
    if (!this.custom()) {
      const span = this.span()
      this.custom.set(span ?? { from: toDay(), to: toDay() })
    }
  }

  protected setMode(key: 'wallets' | 'categories', mode: Mode): void {
    const ids = key === 'wallets' ? this.walletIds : this.categoryIds
    ;(key === 'wallets' ? this.walletMode : this.categoryMode).set(mode)
    if (mode === 'some' && ids().length === 0) {
      this.pickerKey.set(key)
    }
  }

  protected openPicker(key: 'wallets' | 'categories'): void {
    this.pickerKey.set(key)
  }

  protected pickerClosed(open: boolean): void {
    if (open) {
      return
    }
    const key = this.pickerKey()
    // Nothing chosen yet: back on "all" (rule 2).
    if (key === 'wallets' && this.walletIds().length === 0) {
      this.walletMode.set('all')
    }
    if (key === 'categories' && this.categoryIds().length === 0) {
      this.categoryMode.set('all')
    }
    this.pickerKey.set(null)
  }

  protected picked(ids: string[]): void {
    if (this.pickerKey() === 'wallets') {
      this.walletIds.set(ids)
    } else {
      this.categoryIds.set(ids)
    }
  }

  protected async export(): Promise<void> {
    if (this.isProcessing()) {
      return
    }
    this.isProcessing.set(true)
    try {
      const query = this.query()
      const rows = this.read((db) => exportRows(db, query), [])
      const csv = exportCsv(
        rows,
        (key) => this.transloco.translate(key),
        (code) => this.walletService.minorUnit(code)
      )
      const name = exportFileName(this.bookName(), toDay())
      const shared = await this.deliver(csv, name)
      if (shared) {
        toast.success(
          this.transloco.translate(rows.length === 1 ? 'export.exportedOne' : 'export.exported', {
            count: new Intl.NumberFormat(this.languageService.locale()).format(rows.length),
          })
        )
      }
    } finally {
      this.isProcessing.set(false)
    }
  }

  /** Shares the file where the device can (rule 3), else downloads it; false when cancelled. */
  private async deliver(csv: string, name: string): Promise<boolean> {
    const view = this.document.defaultView
    const file = new File([csv], name, { type: 'text/csv' })
    const navigator = view?.navigator
    // Phones share (a sheet to Files, Drive, LINE…); a computer just downloads.
    // `matchMedia` may be missing (an embedded view, the test DOM).
    const media = view as Partial<Pick<Window, 'matchMedia'>> | null
    const coarse =
      typeof media?.matchMedia === 'function' && media.matchMedia('(pointer: coarse)').matches
    if (coarse && 'canShare' in (navigator ?? {}) && navigator?.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return false
        }
        // Sharing refused (no user gesture left, policy): fall back to a download.
      }
    }
    const url = URL.createObjectURL(file)
    const link = this.document.createElement('a')
    link.href = url
    link.download = name
    link.hidden = true
    // Attached while clicked: a detached link may lose its file name.
    this.document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }
}
