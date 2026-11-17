import { Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { DeviceStorageService } from '@/core/pwa'

/** Account › เครื่องนี้: whether the app is installed and its storage kept (#3, opened from A1). */
@Component({
  selector: 'app-device-page',
  imports: [TranslocoPipe],
  templateUrl: './device-page.html',
})
export class DevicePage {
  protected deviceStorageService = inject(DeviceStorageService)
}
