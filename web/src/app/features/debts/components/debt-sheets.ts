import { Component, inject } from '@angular/core'
import { DebtService } from '@/core/debt'
import { DebtCloseSheet } from './close-sheet'
import { DebtSheet } from './debt-sheet'
import { DebtEntrySheet } from './entry-sheet'

/** The debts pages' sheets, each loaded the first time it opens. */
@Component({
  selector: 'app-debt-sheets',
  imports: [DebtSheet, DebtEntrySheet, DebtCloseSheet],
  templateUrl: './debt-sheets.html',
})
export class DebtSheets {
  protected debtService = inject(DebtService)
}
