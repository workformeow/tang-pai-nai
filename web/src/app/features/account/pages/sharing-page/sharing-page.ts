import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronRight,
  lucideEllipsisVertical,
  lucideMail,
  lucidePlus,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { SharingService } from '@/core/sharing'
import type { InviteToMe, ShareGroup } from '@/core/sharing'
import { WalletService } from '@/core/wallet'
import { ShareSheet } from '@/features/account/pages/sharing-page/share-sheet'
import type { ShareSheetState } from '@/features/account/pages/sharing-page/share-sheet'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'

/**
 * Account › แชร์กระเป๋า (docs/features/sharing.md → Web screens, mock-up frames 2 and 6): invites
 * to me, the current book's members and pending invites, wallets shared with nobody, and what
 * others share with me. Online only; offline it shows what was read this session.
 */
@Component({
  selector: 'app-sharing-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, IconBadge, ShareSheet],
  providers: [provideIcons({ lucideChevronRight, lucideEllipsisVertical, lucideMail, lucidePlus })],
  templateUrl: './sharing-page.html',
})
export class SharingPage {
  protected sharingService = inject(SharingService)
  private bookService = inject(BookService)
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)

  protected walletIcon = WALLET_DEFAULT_ICON
  protected sheet = signal<ShareSheetState | null>(null)
  protected busy = signal(false)
  protected loadError = signal<string | null>(null)

  protected book = this.bookService.current
  private owner = computed(() => {
    const id = this.book()?.id
    return id ? this.sharingService.owner(id) : null
  })
  protected members = computed(() => this.owner()?.members ?? [])
  protected pending = computed(() => this.owner()?.invites ?? [])
  protected unshared = computed(() =>
    (this.owner()?.unsharedWalletIds ?? [])
      .map((id) => this.walletService.byId(id))
      .filter((wallet) => wallet !== null)
  )
  protected invites = computed(() => this.sharingService.withMe()?.invites ?? [])
  protected groups = computed(() => this.sharingService.withMe()?.shares ?? [])

  constructor() {
    // Read again whenever the book changes or the network comes back.
    effect(() => {
      const id = this.book()?.id
      const online = this.sharingService.canCall()
      if (id && online) {
        untracked(() => void this.load(id))
      }
    })
  }

  protected initial(name: string): string {
    return [...name.trim()].at(0)?.toUpperCase() ?? '?'
  }

  protected date(at: number): string {
    return new Intl.DateTimeFormat(this.languageService.locale(), { dateStyle: 'medium' }).format(
      at
    )
  }

  protected walletCount(count: number): string {
    return this.transloco.translate(`sharing.walletCount${count === 1 ? 'One' : ''}`, { count })
  }

  protected names(invite: InviteToMe): string {
    return invite.wallets.map((wallet) => wallet.name).join(', ')
  }

  protected walletList(group: ShareGroup): string {
    return group.wallets.map((wallet) => wallet.name).join(', ')
  }

  protected async answer(invite: InviteToMe, accept: boolean): Promise<void> {
    this.busy.set(true)
    try {
      if (accept) {
        await this.sharingService.accept(invite.id)
      } else {
        await this.sharingService.decline(invite.id)
      }
      toast.success(this.transloco.translate(accept ? 'sharing.accepted' : 'sharing.declined'))
    } catch (error) {
      toast.error(this.transloco.translate(this.sharingService.failure(error)))
    } finally {
      this.busy.set(false)
    }
  }

  private async load(bookId: string): Promise<void> {
    try {
      await Promise.all([this.sharingService.loadOwner(bookId), this.sharingService.loadWithMe()])
      this.loadError.set(null)
    } catch (error) {
      this.loadError.set(this.sharingService.failure(error))
    }
  }
}
