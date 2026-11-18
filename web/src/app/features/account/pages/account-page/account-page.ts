import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronRight,
  lucideFileSpreadsheet,
  lucideHousePlus,
  lucideLogOut,
  lucidePalette,
  lucidePencil,
  lucideRepeat,
  lucideScrollText,
  lucideShapes,
  lucideShare2,
  lucideShieldCheck,
  lucideSmartphone,
  lucideUsers,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { AuthService, AuthStore, SIGN_IN_URL } from '@/core/auth'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { OfflineService, SyncService } from '@/core/offline'
import { DeviceStorageService } from '@/core/pwa'
import { SharingService } from '@/core/sharing'
import { ThemeService } from '@/core/theme'
import { ProfileSheet } from '@/features/account/components/profile-sheet'
import { SheetFrame } from '@/shared/components/sheet'

/** A row of the account page: a page to go to, with a short line on what's there. */
interface AccountItem {
  link: string
  icon: string
  label: string
  hint: string
  /** A count on the row (invitations to me, sharing.md). */
  badge?: number
  /** Demo rule 9: shown, but turned off, with "ใช้ไม่ได้ในโหมด Demo" as its hint. */
  disabled?: boolean
}

@Component({
  selector: 'app-account-page',
  imports: [
    TranslocoPipe,
    RouterLink,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    HlmSpinner,
    ProfileSheet,
    SheetFrame,
  ],
  providers: [
    provideIcons({
      lucideChevronRight,
      lucideFileSpreadsheet,
      lucideHousePlus,
      lucideLogOut,
      lucidePalette,
      lucidePencil,
      lucideRepeat,
      lucideScrollText,
      lucideShapes,
      lucideShare2,
      lucideShieldCheck,
      lucideSmartphone,
      lucideUsers,
    }),
  ],
  templateUrl: './account-page.html',
})
/**
 * The Account tab (owner's choice A1 in #7): who is signed in, then grouped rows that each open a
 * page (my data, account and security, settings), and sign-out.
 */
export class AccountPage {
  protected bookService = inject(BookService)
  private transloco = inject(TranslocoService)
  private themeService = inject(ThemeService)
  private languageService = inject(LanguageService)
  private deviceStorageService = inject(DeviceStorageService)
  private router = inject(Router)
  private authService = inject(AuthService)
  private offlineService = inject(OfflineService)
  protected syncService = inject(SyncService)
  protected authStore = inject(AuthStore)
  private sharingService = inject(SharingService)

  /** Sign-out asks first: it ends the session and wipes this device's copy of the data. */
  protected confirming = signal(false)
  /** The "แก้ไขโปรไฟล์" sheet (design A). */
  protected editingProfile = signal(false)
  protected isSigningOut = signal(false)
  protected signOutFailed = signal(false)
  /** Ops that would be lost by signing out now (still pending or rejected after a push). */
  protected unsynced = signal(0)
  /** Demo rules 9 and 12: sharing is off, and ออกจากระบบ becomes จบ Demo. */
  protected isDemo = computed(() => this.authStore.user()?.isDemo === true)

  protected groups = computed<{ key: string; items: AccountItem[] }[]>(() => {
    this.languageService.language() // re-translate on a language switch
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    const book = this.bookService.current()
    const count = this.bookService.books().length
    const persisted = this.deviceStorageService.isPersisted()
    return [
      {
        key: 'data',
        items: [
          {
            link: '/account/books',
            icon: 'lucideUsers',
            label: 'account.books',
            hint: book
              ? t('account.booksHint', { name: book.name, count })
              : t('account.booksNone'),
          },
          {
            link: '/account/categories',
            icon: 'lucideShapes',
            label: 'account.categories',
            hint: book ? t('account.categoriesHint', { name: book.name }) : t('account.booksNone'),
          },
          {
            link: '/account/sharing',
            icon: 'lucideShare2',
            label: 'account.sharing',
            hint: this.isDemo()
              ? t('demo.notAllowed')
              : book
                ? this.sharingHint(book.id, book.name, t)
                : t('account.booksNone'),
            badge: this.sharingService.inviteCount(),
            disabled: this.isDemo(),
          },
          {
            link: '/account/recurring',
            icon: 'lucideRepeat',
            label: 'account.recurring',
            hint: book
              ? t('account.recurringHint', {
                  name: book.name,
                  count: this.bookService.ruleCount(book.id),
                })
              : t('account.booksNone'),
          },
          {
            link: '/account/export',
            icon: 'lucideFileSpreadsheet',
            label: 'account.export',
            hint: book ? t('account.exportHint', { name: book.name }) : t('account.booksNone'),
          },
        ],
      },
      {
        key: 'security',
        items: [
          {
            link: '/account/security',
            icon: 'lucideShieldCheck',
            label: 'account.security',
            hint: t('account.securityHint'),
          },
        ],
      },
      {
        key: 'settings',
        items: [
          {
            link: '/account/appearance',
            icon: 'lucidePalette',
            label: 'account.appearance',
            hint: [
              this.languageService.language().label,
              t(`account.mode${capitalize(this.themeService.preference())}`),
              this.themeService.palette().label,
            ].join(' · '),
          },
          {
            link: '/account/install',
            icon: 'lucideHousePlus',
            label: 'account.install',
            hint: t(
              this.deviceStorageService.isInstalled()
                ? 'account.installedYes'
                : 'account.installHintNo'
            ),
          },
          {
            link: '/account/device',
            icon: 'lucideSmartphone',
            label: 'account.device',
            hint: [
              t(
                this.deviceStorageService.isInstalled()
                  ? 'account.installedYes'
                  : 'account.installedNo'
              ),
              t(
                persisted === true
                  ? 'account.persistentOnHint'
                  : persisted === false
                    ? 'account.persistentOffHint'
                    : 'account.persistentUnknownHint'
              ),
            ].join(' · '),
          },
        ],
      },
      {
        key: 'about',
        items: [
          {
            link: '/account/privacy',
            icon: 'lucideScrollText',
            label: 'account.privacy',
            hint: t('account.privacyHint'),
          },
        ],
      },
    ]
  })

  constructor() {
    // Fresh profile; the one from sign-in is shown meanwhile, and offline it simply stays.
    this.authService.loadMe().catch(() => undefined)
    // "แชร์กับ n คน" on the sharing row (sharing.md → Web screens): read online, kept in memory.
    effect(() => {
      const id = this.bookService.current()?.id
      // A shared book is the owner's to share (sharing rule 1).
      if (id && !this.bookService.isShared() && this.sharingService.canCall()) {
        untracked(() => void this.sharingService.loadOwner(id).catch(() => undefined))
      }
    })
  }

  private sharingHint(
    bookId: string,
    name: string,
    t: (key: string, params?: Record<string, unknown>) => string
  ): string {
    const count = this.sharingService.owner(bookId)?.members.length ?? 0
    if (count === 0) {
      return t('account.sharingHint', { name })
    }
    return t(`account.sharingHintCount${count === 1 ? 'One' : ''}`, { name, count })
  }

  /** The avatar's letter: the name's first character (Thai or Latin). */
  protected initial(name: string): string {
    return [...name.trim()].at(0)?.toUpperCase() ?? ''
  }

  protected cancelSignOut(): void {
    this.confirming.set(false)
    this.unsynced.set(0)
    this.signOutFailed.set(false)
  }

  /** Demo rule 12: the account is deleted at once (no push first: it all goes), then the device. */
  protected async endDemo(): Promise<void> {
    this.isSigningOut.set(true)
    this.signOutFailed.set(false)
    try {
      await this.authService.endDemo()
      await this.offlineService.wipe()
      await this.router.navigateByUrl(SIGN_IN_URL, { replaceUrl: true })
    } catch {
      this.signOutFailed.set(true)
    } finally {
      this.isSigningOut.set(false)
    }
  }

  /** `confirmed`: the user already agreed to lose the ops that couldn't be pushed. */
  protected async signOut(confirmed: boolean): Promise<void> {
    this.isSigningOut.set(true)
    this.signOutFailed.set(false)
    try {
      // Rule 7: push the outbox first, and ask before losing what couldn't be pushed.
      const unsynced = await this.syncService.flush()
      if (unsynced > 0 && !confirmed) {
        this.unsynced.set(unsynced)
        return
      }
      this.unsynced.set(0)
      await this.authService.signOut()
      // Rule 7: this device forgets the signed-out user's data.
      await this.offlineService.wipe()
      await this.router.navigateByUrl(SIGN_IN_URL, { replaceUrl: true })
    } catch {
      this.signOutFailed.set(true)
    } finally {
      this.isSigningOut.set(false)
    }
  }
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
