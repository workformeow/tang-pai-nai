import { syncRegistry } from '@/core/sync'
import { bookSyncHandler } from './book.repository.drizzle'

// Books have no REST routes: devices write them locally and sync them (book rule 1).
syncRegistry.register(bookSyncHandler)
