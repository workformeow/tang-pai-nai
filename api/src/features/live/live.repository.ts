export interface LiveRepository {
  /** Rule 3: the books whose `book:` channel the user may hear at this moment. */
  listenableBooks(userId: string): Promise<string[]>
}
