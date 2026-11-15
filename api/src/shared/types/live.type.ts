// Values for LIVE_PROVIDER (docs/features/live-sync.md → Providers). Adding a provider = a new
// value here + an adapter in core/live/live.<provider>.ts + an entry in live.registry.ts.
export enum LiveProviderName {
  DISABLED = 'disabled',
  LOCAL = 'local',
  ABLY = 'ably',
}
