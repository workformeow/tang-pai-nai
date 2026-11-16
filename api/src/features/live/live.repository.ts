export interface LiveRepository {
  /** Rule 3: the profiles whose `profile:` channel the user may hear at this moment. */
  listenableProfiles(userId: string): Promise<string[]>
}
