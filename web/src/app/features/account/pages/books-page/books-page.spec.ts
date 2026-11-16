import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router'
import type { ParamMap } from '@angular/router'
import { BehaviorSubject } from 'rxjs'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { BookService } from '@/core/book'
import type { Book } from '@/core/book'
import th from '@/core/i18n/th.json'
import { BooksPage } from './books-page'

const book = (id: string, name: string, sortOrder: number): Book => ({
  id,
  name,
  icon: 'lucideHouse',
  color: '#16a34a',
  sortOrder,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  changeSeq: 1,
})

describe('BooksPage', () => {
  let fixture: ComponentFixture<BooksPage>
  let query: BehaviorSubject<ParamMap>
  let navigate: ReturnType<typeof vi.spyOn>
  const list = signal<Book[]>([])
  const service = {
    books: list,
    current: signal<Book | null>(null),
    pendingIds: signal(new Set<string>()),
    canWrite: signal(true),
    atLimit: signal(false),
    open: vi.fn(),
    openFix: vi.fn(),
    moveTo: vi.fn(),
  }

  const page = () => fixture.nativeElement as HTMLElement
  const button = (label: string) =>
    [...page().querySelectorAll('button')].find(
      (b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label
    )
  const handle = (name: string) =>
    page().querySelector(`button[aria-label^="ย้าย ${name} "]`) as HTMLButtonElement
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    list.set([book('a', 'Home', 0), book('b', 'Work', 1), book('c', 'Shop', 2)])
    service.current.set(list()[0])
    service.pendingIds.set(new Set(['b']))
    service.atLimit.set(false)
    query = new BehaviorSubject(convertToParamMap({}))
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: BookService, useValue: service },
        { provide: ActivatedRoute, useValue: { queryParamMap: query } },
      ],
    })
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    fixture = TestBed.createComponent(BooksPage)
    await settle()
  })

  it('lists the books in order, with the current one and a pending one marked', () => {
    const rows = [...page().querySelectorAll('li')].map((li) => li.textContent)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toContain(th.books.currentHere)
    expect(rows[1]).toContain(th.books.pending)
  })

  it('opens a book in the sheet when its row is tapped', () => {
    button('แก้ไข Work')?.click()
    expect(service.open).toHaveBeenCalledWith({ mode: 'edit', id: 'b' })
  })

  it('shows one drag handle per row in order mode, and none outside it', async () => {
    expect(handle('Home')).toBeNull()
    button(th.books.order)?.click()
    await settle()
    expect(page().querySelectorAll('button[aria-label^="ย้าย"]')).toHaveLength(3)
    expect(page().textContent).toContain(th.books.orderHint)
    button(th.books.orderDone)?.click()
    await settle()
    expect(handle('Home')).toBeNull()
  })

  it('moves a row with the arrow keys on its handle', async () => {
    button(th.books.order)?.click()
    await settle()
    handle('Work').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(service.moveTo).toHaveBeenLastCalledWith('b', 0)
    handle('Work').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(service.moveTo).toHaveBeenLastCalledWith('b', 2)
  })

  it('opens the fix of a rejected op from the sync sheet, then clears the query', async () => {
    query.next(convertToParamMap({ fix: 'op-1' }))
    await settle()
    expect(service.openFix).toHaveBeenCalledWith('op-1')
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: {},
      replaceUrl: true,
    })
  })

  it('hides "add" at 20 books and says why', async () => {
    service.atLimit.set(true)
    await settle()
    expect(button(th.books.add)).toBeUndefined()
    expect(page().textContent).toContain(th.books.limit)
  })
})
