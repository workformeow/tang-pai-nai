import { DOCUMENT } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { BootSplash } from './boot-splash'

describe('BootSplash', () => {
  let splash: HTMLElement
  let bootSplash: BootSplash

  const element = () => TestBed.inject(DOCUMENT).getElementById('boot-splash')

  beforeEach(() => {
    splash = TestBed.inject(DOCUMENT).createElement('div')
    splash.id = 'boot-splash'
    splash.dataset['step'] = 'app'
    TestBed.inject(DOCUMENT).body.append(splash)
    bootSplash = TestBed.inject(BootSplash)
  })

  afterEach(() => {
    splash.remove()
    vi.useRealTimers()
  })

  it('sets the step the splash shows (loading.md rule 2)', () => {
    bootSplash.step('data')
    expect(splash.dataset['step']).toBe('data')
  })

  it('fades the splash out, then takes it off the page once (rule 1)', () => {
    vi.useFakeTimers()
    bootSplash.done()
    expect(splash.classList.contains('boot-out')).toBe(true)
    expect(element()).toBe(splash)
    bootSplash.done()
    vi.advanceTimersByTime(200)
    expect(element()).toBeNull()
  })

  it('does nothing on a page without a splash', () => {
    splash.remove()
    expect(() => {
      bootSplash.step('auth')
      bootSplash.done()
    }).not.toThrow()
  })
})
