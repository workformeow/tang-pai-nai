import { Component, inject, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { TextareaField } from './textarea-field'

@Component({
  imports: [TextareaField],
  template: `<app-textarea-field
    [control]="control"
    label="Note"
    [autofocus]="autofocus()"
    [doneOnEnter]="doneOnEnter()"
    (done)="done = done + 1"
  />`,
})
class Host {
  control = inject(NonNullableFormBuilder).control('')
  autofocus = signal(true)
  doneOnEnter = signal(true)
  done = 0
}

describe('TextareaField', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({ langs: {}, translocoConfig: { defaultLang: 'th' } }),
      ],
    })
  })

  const setup = async (options: { autofocus?: boolean; doneOnEnter?: boolean } = {}) => {
    const fixture = TestBed.createComponent(Host)
    fixture.componentInstance.autofocus.set(options.autofocus ?? true)
    fixture.componentInstance.doneOnEnter.set(options.doneOnEnter ?? true)
    document.body.append(fixture.nativeElement as HTMLElement)
    await fixture.whenStable()
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!
    const press = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init })
      textarea.dispatchEvent(event)
      return event
    }
    return { fixture, host: fixture.componentInstance, textarea, press }
  }

  /** jsdom's document is hidden and unfocused unless told otherwise. */
  const inForeground = (visible: boolean) => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(!visible)
    vi.spyOn(document, 'hasFocus').mockReturnValue(visible)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('takes the focus on first render with autofocus, and not without it', async () => {
    const { textarea, fixture } = await setup()
    expect(document.activeElement).toBe(textarea)
    fixture.destroy()
    const plain = await setup({ autofocus: false })
    expect(document.activeElement).not.toBe(plain.textarea)
  })

  it('finishes on Enter with doneOnEnter, the return key reading "done"', async () => {
    const { textarea, host, press } = await setup()
    expect(textarea.getAttribute('enterkeyhint')).toBe('done')
    expect(press({}).defaultPrevented).toBe(true)
    expect(host.done).toBe(1)
  })

  it('keeps Shift + Enter and a composing Enter as typing', async () => {
    const { host, press } = await setup()
    expect(press({ shiftKey: true }).defaultPrevented).toBe(false)
    expect(press({ isComposing: true }).defaultPrevented).toBe(false)
    expect(host.done).toBe(0)
  })

  it('finishes when the user leaves the text, not when the app goes to the background', async () => {
    const { textarea, host } = await setup()
    inForeground(false)
    textarea.dispatchEvent(new FocusEvent('blur'))
    expect(host.done).toBe(0)
    inForeground(true)
    textarea.dispatchEvent(new FocusEvent('blur'))
    expect(host.done).toBe(1)
  })

  it('is a plain textarea without doneOnEnter', async () => {
    const { textarea, host, press } = await setup({ doneOnEnter: false })
    inForeground(true)
    expect(textarea.hasAttribute('enterkeyhint')).toBe(false)
    expect(press({}).defaultPrevented).toBe(false)
    textarea.dispatchEvent(new FocusEvent('blur'))
    expect(host.done).toBe(0)
  })
})
