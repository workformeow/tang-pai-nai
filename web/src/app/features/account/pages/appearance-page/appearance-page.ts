import { Component, computed, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { LANGUAGES, LanguageService } from '@/core/i18n'
import type { Language } from '@/core/i18n'
import { PALETTES, ThemeService } from '@/core/theme'
import type { PaletteId, ThemePreference } from '@/core/theme'
import { QuickAmountsService } from '@/core/transaction'
import { PalettePicker } from '@/features/account/pages/account-page/palette-picker'
import { SegmentedField, SwitchField } from '@/shared/components/form'
import type { SelectOption } from '@/shared/types'

/**
 * Account › การแสดงผล: language, mode, theme (DESIGN.md §3, §11) and the keypad's quick amounts
 * (transaction.md, 8.2), each applied at once.
 */
@Component({
  selector: 'app-appearance-page',
  imports: [TranslocoPipe, SegmentedField, SwitchField, PalettePicker],
  templateUrl: './appearance-page.html',
})
export class AppearancePage {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private themeService = inject(ThemeService)
  private languageService = inject(LanguageService)
  private quickAmountsService = inject(QuickAmountsService)

  protected readonly palettes = PALETTES
  // TH / EN read the same in either language, so they never need translating.
  protected readonly languageOptions: readonly SelectOption<Language>[] = LANGUAGES.map(
    (language) => ({ value: language.id, label: language.label })
  )
  protected themeOptions = computed<readonly SelectOption<ThemePreference>[]>(() => {
    this.languageService.language() // re-translate on a language switch
    return [
      { value: 'system', label: this.transloco.translate('account.modeSystem') },
      { value: 'light', label: this.transloco.translate('account.modeLight') },
      { value: 'dark', label: this.transloco.translate('account.modeDark') },
    ]
  })

  // Plain strings, as the segmented field takes; values only ever come from the options.
  protected languageControl = this.nnfb.control<string>(this.languageService.language().id)
  protected themeControl = this.nnfb.control<string>(this.themeService.preference())
  protected paletteControl = this.nnfb.control<PaletteId>(this.themeService.palette().id)
  protected quickAmountsControl = this.nnfb.control(this.quickAmountsService.enabled())

  constructor() {
    this.languageControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((language) => {
      if (language) {
        this.languageService.setLanguage(language as Language).catch((error: unknown) => {
          console.error('Language switch failed', error)
        })
      }
    })
    this.themeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((preference) => {
      if (preference) {
        this.themeService.setPreference(preference as ThemePreference)
      }
    })
    this.paletteControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.themeService.setPalette(id))
    this.quickAmountsControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((enabled) => this.quickAmountsService.setEnabled(enabled))
  }
}
