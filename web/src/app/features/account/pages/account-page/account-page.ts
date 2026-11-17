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
  template: `
    <div class="flex flex-col gap-6 p-4">
      @if (authStore.user(); as user) {
        <!-- Design A: the whole card opens "แก้ไขโปรไฟล์". -->
        <button
          type="button"
          class="flex min-h-18 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-card-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [attr.aria-label]="'profile.edit' | transloco"
          (click)="editingProfile.set(true)"
        >
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold"
            aria-hidden="true"
            >{{ initial(user.displayName) }}</span
          >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-base font-semibold break-all">{{ user.displayName }}</span>
            <!-- A demo's address is a placeholder no mail reaches (demo.md → Data model). -->
            <span class="text-sm break-all text-muted-foreground">{{
              user.isDemo ? ('demo.profileLine' | transloco) : user.email
            }}</span>
          </span>
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <ng-icon name="lucidePencil" size="18" />
          </span>
        </button>
      }
      @for (group of groups(); track group.key) {
        <section class="flex flex-col gap-3" [attr.aria-labelledby]="'account-' + group.key">
          <h2 [id]="'account-' + group.key" class="text-sm font-medium text-muted-foreground">
            {{ 'account.group.' + group.key | transloco }}
          </h2>
          <ul
            class="divide-y divide-border rounded-xl border border-border bg-card text-card-foreground"
          >
            @for (item of group.items; track item.link) {
              <li>
                @if (item.disabled) {
                  <div
                    class="flex min-h-14 items-center gap-3 px-4 py-2 opacity-60"
                    aria-disabled="true"
                  >
                    <span
                      class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl text-muted-foreground"
                      aria-hidden="true"
                    >
                      <ng-icon [name]="item.icon" />
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="text-base">{{ item.label | transloco }}</span>
                      <span class="truncate text-sm text-muted-foreground">{{ item.hint }}</span>
                    </span>
                  </div>
                } @else {
                  <a
                    class="flex min-h-14 items-center gap-3 px-4 py-2 first:rounded-t-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    [routerLink]="item.link"
                  >
                    <span
                      class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl text-muted-foreground"
                      aria-hidden="true"
                    >
                      <ng-icon [name]="item.icon" />
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="text-base"
                        >{{ item.label | transloco }}
                        @if (item.badge) {
                          <span
                            class="ml-1 rounded-full bg-destructive px-1.5 text-xs font-semibold text-white"
                            >{{ item.badge }}</span
                          >
                        }
                      </span>
                      <span class="truncate text-sm text-muted-foreground">{{ item.hint }}</span>
                    </span>
                    <ng-icon
                      name="lucideChevronRight"
                      size="20"
                      class="text-muted-foreground"
                      aria-hidden="true"
                    />
                  </a>
                }
              </li>
            }
          </ul>
        </section>
      }

      <button
        hlmBtn
        variant="outline"
        type="button"
        class="h-11 w-full text-base"
        (click)="confirming.set(true)"
      >
        <ng-icon name="lucideLogOut" aria-hidden="true" />
        {{ (isDemo() ? 'demo.end' : 'account.signOut') | transloco }}
      </button>
    </div>

    @defer (when editingProfile()) {
      <app-profile-sheet [(open)]="editingProfile" />
    }

    <!-- Sign-out asks first, in a bottom sheet like every other question (DESIGN.md §6). -->
    @defer (when confirming()) {
      <hlm-drawer [state]="confirming() ? 'open' : 'closed'" (closed)="cancelSignOut()">
        <hlm-drawer-content
          *hlmDrawerPortal
          class="mx-auto h-[92dvh] w-full max-w-120 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
        >
          <app-sheet-frame
            [title]="(isDemo() ? 'demo.end' : 'account.signOut') | transloco"
            [leadingLabel]="'sheet.close' | transloco"
            (leading)="cancelSignOut()"
          >
            <div class="flex flex-col items-center gap-4 pt-6 text-center">
              <span
                class="flex size-14 items-center justify-center rounded-full bg-muted text-2xl text-destructive"
                aria-hidden="true"
              >
                <ng-icon name="lucideLogOut" />
              </span>
              @if (isDemo()) {
                <!-- Demo rule 12: it asks once, then the account goes at once. -->
                <p class="text-base">{{ 'demo.endConfirm' | transloco }}</p>
              } @else if (unsynced() > 0) {
                <p class="text-base">
                  {{ 'account.signOutUnsynced' | transloco: { count: unsynced() } }}
                </p>
              } @else {
                <p class="text-base">{{ 'account.signOutConfirmText' | transloco }}</p>
              }
              @if (signOutFailed()) {
                <p role="alert" class="text-sm text-destructive">
                  {{ (isDemo() ? 'demo.endFailed' : 'account.signOutFailed') | transloco }}
                </p>
              }
            </div>
            <div sheetFooter class="flex flex-col gap-2 pt-3">
              <button
                hlmBtn
                variant="destructive"
                type="button"
                class="h-11 w-full text-base"
                [disabled]="isSigningOut()"
                (click)="isDemo() ? endDemo() : signOut(unsynced() > 0)"
              >
                @if (isSigningOut()) {
                  <hlm-spinner
                    [aria-label]="(isDemo() ? 'demo.ending' : 'account.signingOut') | transloco"
                  />
                }
                {{
                  (isDemo()
                    ? 'demo.end'
                    : unsynced() > 0
                      ? 'account.signOutUnsyncedConfirm'
                      : 'account.signOut'
                  ) | transloco
                }}
              </button>
              <button
                hlmBtn
                variant="outline"
                type="button"
                class="h-11 w-full text-base"
                [disabled]="isSigningOut()"
                (click)="cancelSignOut()"
              >
                {{ 'account.cancel' | transloco }}
              </button>
            </div>
          </app-sheet-frame>
        </hlm-drawer-content>
      </hlm-drawer>
    }
  `,
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
