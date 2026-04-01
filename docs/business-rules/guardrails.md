# Guardrails — Non-Negotiable Business Rules

## Rate Protection
- **$1,000 block:** Any rate exactly $1,000 is a Resly mis-sync. Block immediately.
- **Floor protection:** No rate below the property's floor_rate in signalos_property_context.
- **Sanity ceiling:** No rate above historical max × 10.
- **Operational minimum:** No rate below $50.

## Stay Restrictions
- **Minimum 2 nights.** One-night stays are never permitted.

## Approval Thresholds
- Manual price change >20%: escalate to Dan.
- Bulk action >10 properties: escalate to Dan.
- New property onboarding: always Dan approval.
- Genius Level 3: always Dan approval.
- Owner report send: always PM manager approval.

## Iris Gate
- Confidence score < 4.0: suppress ALL pricing increases.
- Confidence score < 4.5: soften far-future premium, no Genius Level 2.

## Surge Auto-Execution
- Tiers 2+ auto-execute immediately. Never wait for approval.
- Notify Dan via Telegram AFTER execution.
- Black Swan: auto-execute, notify within 90 seconds.

## Cooldown
- 14-day settling period after major price changes.
- During cooldown: queue new changes, never override.

## Rollback
- 72-hour rollback window on all executed actions.
- Max 5 rollback operations per hour (rate limited).

## Rate Limits
| Operation | Max | Window |
|-----------|-----|--------|
| Black Swan manual | 3 | 24 hours |
| Surge changes/property | 10 | 1 hour |
| PriceLabs writes | 100 | 1 hour |
| Rollback operations | 5 | 1 hour |
| Telegram commands/user | 10 | 1 minute |
