import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import type { FormControl, FormGroup } from '@angular/forms'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { SharingService } from '@/core/sharing'
import type { ShareGroup, ShareRole, SharingInvite, SharingMember } from '@/core/sharing'
import { WalletService } from '@/core/wallet'
import {
  FORM_IMPORTS,
  InputField,
  SegmentedField,
  ToggleListField,
  withMessage,
} from '@/shared/components/form'
import type { ToggleListItem } from '@/shared/components/form'
import { WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'

/** What the sheet shows (docs/features/sharing.md → Web screens, mock-up frames 3–4, 6). */
export type ShareSheetState =
  | { view: 'invite' }
  | { view: 'member'; member: SharingMember }
  | { view: 'pending'; invite: SharingInvite }
  | { view: 'leave'; group: ShareGroup }

type ShareFormGroup = FormGroup<{
  email: FormControl<string>
  role: FormControl<ShareRole>
  /** The wallets switched **off** (`app-toggle-list-field` keeps those). */
  offWalletIds: FormControl<string[]>
}>

/**
 * The sharing page's one sheet: invite a person, change a member (role, wallets, remove), a
 * pending invite (send again, cancel) and leaving someone's sharing. Every action is an online
 * call (sharing rule 10); the page reloads what it shows from the service afterwards.
 */
@Component({
  selector: 'app-share-sheet',
  imports: [
    TranslocoPipe,
    HlmButton,
    HlmDrawerImports,
    HlmSpinner,
    SheetFrame,
    FORM_IMPORTS,
    InputField,
    SegmentedField,
    ToggleListField,
  ],
  templateUrl: './share-sheet.html',
})
export class ShareSheet {
  protected sharingService = inject(SharingService)
  private walletService = inject(WalletService)
  private bookService = inject(BookService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private nnfb = inject(NonNullableFormBuilder)

  state = input<ShareSheetState | null>(null)
  closed = output()

  protected busy = signal(false)
  protected error = signal<string | null>(null)
  protected confirming = signal(false)

  protected form: ShareFormGroup = this.nnfb.group({
    email: [
      '',
      [
        withMessage(Validators.required, 'sharing.emailRequired'),
        withMessage(Validators.email, 'sharing.emailInvalid'),
      ],
    ],
    role: this.nnfb.control<ShareRole>('editor'),
    offWalletIds: this.nnfb.control<string[]>([]),
  })
  private formValue = signal(this.form.getRawValue())
  private emailValid = signal(false)
  protected role = computed(() => this.formValue().role)

  /** Rule 2: the book's open wallets (archived ones aren't offered). */
  private openWallets = computed(() => this.walletService.wallets().filter((w) => !w.isArchived))
  protected walletItems = computed<ToggleListItem[]>(() =>
    this.openWallets().map((wallet) => ({
      id: wallet.id,
      label: wallet.name,
      icon: wallet.icon,
      color: wallet.color,
      fallback: WALLET_DEFAULT_ICON,
    }))
  )
  protected pickedCount = computed(
    () => this.walletItems().length - this.formValue().offWalletIds.length
  )
  protected canSubmit = computed(() => {
    const view = this.state()?.view
    return view === 'member' || (this.pickedCount() > 0 && this.emailValid())
  })
  protected roleOptions = computed(() => {
    this.languageService.language()
    return (['editor', 'viewer'] as const).map((value) => ({
      value,
      label: this.transloco.translate(`sharing.${value}`),
    }))
  })
  protected title = computed(() => {
    this.languageService.language()
    const state = this.state()
    switch (state?.view) {
      case 'member':
        return state.member.displayName
      case 'pending':
        return this.transloco.translate('sharing.pendingTitle')
      case 'leave':
        return this.transloco.translate('sharing.leave', { name: state.group.owner.displayName })
      default:
        return this.transloco.translate('sharing.invite')
    }
  })

  constructor() {
    // Every form event (value or validity) refreshes the signals the template reads.
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formValue.set(this.form.getRawValue())
      this.emailValid.set(this.form.controls.email.valid)
    })
    // A new state starts a fresh form: an invite ticks every wallet, a member their wallets.
    effect(() => {
      const state = this.state()
      untracked(() => this.reset(state))
    })
  }

  protected date(at: number): string {
    return new Intl.DateTimeFormat(this.languageService.locale(), { dateStyle: 'medium' }).format(
      at
    )
  }

  protected walletNames(ids: string[]): string {
    return ids
      .map((id) => this.walletService.byId(id)?.name)
      .filter((name) => name)
      .join(', ')
  }

  protected toggleAll(): void {
    const all = this.walletItems().map((item) => item.id)
    const off = this.pickedCount() === all.length ? all : []
    this.form.controls.offWalletIds.setValue(off)
  }

  protected async submit(): Promise<void> {
    const state = this.state()
    const bookId = this.bookService.current()?.id
    this.form.markAllAsTouched()
    if (!state || !bookId || !this.canSubmit() || this.busy()) {
      return
    }
    const { email, role, offWalletIds } = this.form.getRawValue()
    const off = new Set(offWalletIds)
    const walletIds = this.openWallets()
      .map((w) => w.id)
      .filter((id) => !off.has(id))
    await this.guard(async () => {
      if (state.view === 'member') {
        await this.sharingService.updateMember(bookId, state.member.userId, { role, walletIds })
        toast.success(this.t(walletIds.length ? 'sharing.saved' : 'sharing.removed'))
      } else {
        await this.sharingService.invite(
          bookId,
          { email: email.trim(), role, walletIds },
          this.lang()
        )
        toast.success(this.t('sharing.sent'))
      }
    })
  }

  protected async run(action: 'resend' | 'cancel' | 'leave' | 'remove'): Promise<void> {
    const state = this.state()
    const bookId = this.bookService.current()?.id ?? ''
    if (!state || this.busy()) {
      return
    }
    await this.guard(async () => {
      if (state.view === 'pending' && action === 'resend') {
        await this.sharingService.resend(bookId, state.invite.id, this.lang())
        toast.success(this.t('sharing.resent'))
      } else if (state.view === 'pending') {
        await this.sharingService.cancel(bookId, state.invite.id)
        toast.success(this.t('sharing.cancelled'))
      } else if (state.view === 'leave') {
        await this.sharingService.leave(state.group.bookId)
        toast.success(this.t('sharing.left'))
      } else if (state.view === 'member') {
        await this.sharingService.removeMember(bookId, state.member.userId)
        toast.success(this.t('sharing.removed'))
      }
    })
  }

  /** Runs one call: closes the sheet on success, shows the failure's text otherwise. */
  private async guard(work: () => Promise<void>): Promise<void> {
    this.busy.set(true)
    this.error.set(null)
    try {
      await work()
      this.closed.emit()
    } catch (error) {
      this.error.set(this.sharingService.failure(error))
    } finally {
      this.busy.set(false)
    }
  }

  private reset(state: ShareSheetState | null): void {
    this.error.set(null)
    this.confirming.set(false)
    const all = this.openWallets().map((w) => w.id)
    const shared = state?.view === 'member' ? new Set(state.member.walletIds) : new Set(all)
    this.form.reset({
      email: '',
      role: state?.view === 'member' ? state.member.role : 'editor',
      offWalletIds: all.filter((id) => !shared.has(id)),
    })
  }

  private lang(): string {
    return this.languageService.language().id
  }

  private t(key: string): string {
    return this.transloco.translate(key)
  }
}
