import { Component, computed, input } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { glyphColor, userColor } from './user-colors'
import { FALLBACK_ICON, knownIcon, USER_ICONS } from './user-icons'
import type { UserIcon } from './user-icons'

/** A user-coloured circle with a lucide or `tpn` glyph (DESIGN.md §6 list rows). Decorative. */
@Component({
  selector: 'app-icon-badge',
  imports: [NgIcon],
  providers: [provideIcons(USER_ICONS)],
  host: { 'aria-hidden': 'true', class: 'inline-flex shrink-0' },
  templateUrl: './icon-badge.html',
})
export class IconBadge {
  icon = input.required<string>()
  color = input.required<string>()
  /** Circle diameter in px: 40 in rows, 24 in the header. */
  size = input(40)
  /** Drawn for an icon name this build doesn't know. */
  fallback = input<UserIcon>(FALLBACK_ICON)

  protected name = computed(() => knownIcon(this.icon(), this.fallback()))
  protected fill = computed(() => userColor(this.color()))
  protected glyph = computed(() => glyphColor(this.fill()))
  protected iconSize = computed(() => `${Math.round(this.size() / 2)}`)
}
