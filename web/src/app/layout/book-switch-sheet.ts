import { Component, computed, inject, input, model } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideCheck,
  lucidePlus,
  lucideSettings2,
  lucideUsers,
  lucideWifiOff,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import type { SharingService, ShareGroup } from '@/core/sharing'
import { IconBadge } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'

/**
 * The switcher's sheet: books in order, add (footer), manage (header icon); book.md. Then
 * "แชร์กับฉัน": books shared with me, online only (sharing rule 10).
 */
@Component({
  selector: 'app-book-switch-sheet',
  imports: [TranslocoPipe, RouterLink, NgIcon, HlmButton, HlmDrawerImports, IconBadge, SheetFrame],
  providers: [
    provideIcons({ lucideCheck, lucidePlus, lucideSettings2, lucideUsers, lucideWifiOff }),
  ],
  template: `
    <hlm-drawer [state]="open() ? 'open' : 'closed'" (closed)="open.set(false)">
      <hlm-drawer-content
        *hlmDrawerPortal
        class="mx-auto h-[92dvh] w-full max-w-[480px] data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
      >
        <app-sheet-frame
          [title]="'books.switchHeading' | transloco"
          [leadingLabel]="'sheet.close' | transloco"
          (leading)="open.set(false)"
        >
          <div sheetActions class="flex">
            <a
              hlmBtn
              variant="ghost"
              size="icon"
              class="tpn-hit size-9"
              routerLink="/account/books"
              [attr.aria-label]="'books.manage' | transloco"
              (click)="open.set(false)"
            >
              <ng-icon name="lucideSettings2" size="18" aria-hidden="true" />
            </a>
          </div>
          <ul class="flex flex-col" [attr.aria-label]="'books.switchHeading' | transloco">
            @for (book of bookService.books(); track book.id) {
              @let current = !bookService.isShared() && book.id === bookService.current()?.id;
              <li>
                <button
                  type="button"
                  class="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  [class.bg-muted]="current"
                  [attr.aria-current]="current ? 'true' : null"
                  (click)="pick(book.id)"
                >
                  <app-icon-badge [icon]="book.icon" [color]="book.color" />
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate text-base">{{ book.name }}</span>
                    @if (bookService.pendingIds().has(book.id)) {
                      <span class="text-sm text-muted-foreground">
                        {{ 'books.pending' | transloco }}
                      </span>
                    }
                  </span>
                  @if (current) {
                    <ng-icon name="lucideCheck" size="20" class="text-brand" aria-hidden="true" />
                  }
                </button>
              </li>
            }
          </ul>
          @if (groups().length > 0) {
            <section class="mt-4 flex flex-col gap-2" aria-labelledby="switch-shared">
              <h3 id="switch-shared" class="px-2 text-sm font-medium text-muted-foreground">
                {{ 'sharing.withMe' | transloco }}
              </h3>
              @if (!canCall()) {
                <p
                  class="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <ng-icon name="lucideWifiOff" size="16" aria-hidden="true" />
                  {{ 'sharing.bookOnline' | transloco }}
                </p>
              }
              <ul class="flex flex-col">
                @for (group of groups(); track group.bookId) {
                  @let current = bookService.shared()?.book?.id === group.bookId;
                  <li>
                    <button
                      type="button"
                      class="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                      [class.bg-muted]="current"
                      [attr.aria-current]="current ? 'true' : null"
                      [disabled]="!canCall()"
                      (click)="pickShared(group)"
                    >
                      <app-icon-badge [icon]="group.book.icon" [color]="group.book.color" />
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="truncate text-base">{{ group.book.name }}</span>
                          <span
                            class="shrink-0 rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground"
                            >{{ 'sharing.' + group.role | transloco }}</span
                          >
                        </span>
                        <span class="flex items-center gap-1 text-sm text-muted-foreground">
                          <ng-icon name="lucideUsers" size="13" aria-hidden="true" />
                          {{
                            (group.wallets.length === 1
                              ? 'sharing.ofOwnerWalletOne'
                              : 'sharing.ofOwnerWallets'
                            )
                              | transloco
                                : { name: group.owner.displayName, count: group.wallets.length }
                          }}
                        </span>
                      </span>
                      @if (current) {
                        <ng-icon
                          name="lucideCheck"
                          size="20"
                          class="text-brand"
                          aria-hidden="true"
                        />
                      }
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
          @if (!bookService.atLimit()) {
            <div sheetFooter class="pt-3">
              <button
                hlmBtn
                type="button"
                class="h-11 w-full text-base"
                [disabled]="!ownCanWrite()"
                (click)="add()"
              >
                <ng-icon name="lucidePlus" size="20" aria-hidden="true" />
                {{ 'books.add' | transloco }}
              </button>
            </div>
          }
        </app-sheet-frame>
      </hlm-drawer-content>
    </hlm-drawer>
  `,
})
export class BookSwitchSheet {
  protected bookService = inject(BookService)

  open = model(false)
  /** Loaded by the shell after its first render (null until then). */
  sharing = input<SharingService | null>(null)

  protected groups = computed(() => this.sharing()?.withMe()?.shares ?? [])
  protected canCall = computed(() => this.sharing()?.canCall() ?? false)

  protected pickShared(group: ShareGroup): void {
    this.open.set(false)
    void this.sharing()?.openShared(group)
  }

  protected pick(id: string): void {
    this.bookService.select(id)
    this.open.set(false)
  }

  /** "เพิ่มสมุด" adds an own book: what an own one could write. */
  protected ownCanWrite = computed(() => this.bookService.isShared() || this.bookService.canWrite())

  protected add(): void {
    this.bookService.leaveShared()
    this.open.set(false)
    this.bookService.open({ mode: 'create' })
  }
}
