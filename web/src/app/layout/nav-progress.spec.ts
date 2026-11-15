import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { NAV_PROGRESS_DELAY_MS, NavProgress } from './nav-progress'

@Component({ template: '' })
class Blank {}

describe('NavProgress', () => {
  let fixture: ComponentFixture<NavProgress>
  let router: Router
  let release: () => void = () => undefined

  const host = () => fixture.nativeElement as HTMLElement
  const bar = () => host().querySelector<HTMLElement>('.origin-left')
  const scale = () => Number(/scaleX\(([\d.]+)\)/.exec(bar()?.style.transform ?? '')?.[1] ?? NaN)
  /** Runs the clock (and the router's promises in between), then renders. */
  const advance = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms)
    fixture.detectChanges()
  }
  const flush = async () => advance(0)

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: Blank },
          { path: 'b', component: Blank },
          {
            path: 'slow',
            component: Blank,
            canActivate: [
              async () =>
                new Promise<boolean>((resolve) => {
                  release = () => resolve(true)
                }),
            ],
          },
        ]),
      ],
    })
    router = TestBed.inject(Router)
    fixture = TestBed.createComponent(NavProgress)
    fixture.detectChanges()
    // The first navigation belongs to the splash.
    await router.navigateByUrl('/a')
    vi.useFakeTimers()
  })

  afterEach(() => {
    fixture.destroy()
    vi.useRealTimers()
  })

  it('shows nothing for the first navigation or a fast one (loading.md rule 5)', async () => {
    expect(bar()).toBeNull()
    await router.navigateByUrl('/b')
    expect(router.url).toBe('/b')
    await advance(NAV_PROGRESS_DELAY_MS * 2)
    expect(bar()).toBeNull()
  })

  it('shows after 300ms, creeps but holds under 90%, then fills and goes', async () => {
    const done = router.navigateByUrl('/slow')
    await flush()
    await advance(NAV_PROGRESS_DELAY_MS - 1)
    expect(bar()).toBeNull()
    await advance(1)
    expect(scale()).toBeCloseTo(0.2)
    await advance(1500)
    const middle = scale()
    expect(middle).toBeGreaterThan(0.2)
    await advance(60_000)
    expect(scale()).toBeGreaterThan(middle)
    expect(scale()).toBeLessThan(0.9)

    release()
    await done
    await flush()
    expect(scale()).toBe(1)
    await advance(200)
    expect(host().querySelector('.opacity-0')).not.toBeNull()
    await advance(200)
    expect(bar()).toBeNull()
  })
})
