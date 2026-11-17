import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { AuthService, AuthStore } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { InputField, withMessage } from '@/shared/components/form'
import { SheetFrame } from '@/shared/components/sheet'

/** The longest display name the API takes (`PATCH /auth/me`). */
const NAME_MAX = 50

/**
 * "แก้ไขโปรไฟล์": the user's display name, the one people sharing a book see. Saved straight to
 * the server (account data, not synced), so it needs the network.
 */
@Component({
  selector: 'app-profile-sheet',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HlmButton,
    HlmDrawerImports,
    HlmSpinner,
    InputField,
    SheetFrame,
  ],
  templateUrl: './profile-sheet.html',
})
export class ProfileSheet {
  open = model(false)

  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private authService = inject(AuthService)
  private authStore = inject(AuthStore)
  private networkStatusService = inject(NetworkStatusService)
  private languageService = inject(LanguageService)

  protected isSaving = signal(false)
  protected failed = signal(false)
  protected canSave = computed(
    () => this.networkStatusService.isOnline() && this.networkStatusService.serverReachable()
  )

  protected form = this.nnfb.group({
    displayName: [
      '',
      [
        withMessage(Validators.required, 'profile.nameRequired'),
        withMessage(Validators.pattern(/\S/), 'profile.nameRequired'),
        Validators.maxLength(NAME_MAX),
      ],
    ],
  })

  private name = toSignal(this.form.controls.displayName.valueChanges, { initialValue: '' })
  protected hint = computed(() => {
    this.languageService.language() // re-translate on a language switch
    return `${this.transloco.translate('profile.hint')} · ${this.name().trim().length}/${NAME_MAX}`
  })

  constructor() {
    // Each opening starts from the name the account has now.
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.form.reset({ displayName: this.authStore.user()?.displayName ?? '' })
          this.failed.set(false)
        })
      }
    })
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched()
    if (this.form.invalid || !this.canSave() || this.isSaving()) {
      return
    }
    const displayName = this.form.controls.displayName.value.trim()
    if (displayName === this.authStore.user()?.displayName) {
      this.open.set(false)
      return
    }
    this.isSaving.set(true)
    this.failed.set(false)
    try {
      await this.authService.updateProfile(displayName)
      this.open.set(false)
      toast.success(this.transloco.translate('profile.saved'))
    } catch {
      this.failed.set(true)
    } finally {
      this.isSaving.set(false)
    }
  }
}
