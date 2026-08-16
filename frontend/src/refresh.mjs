export function refreshIntervalForVisibility(visibilityState) {
  return visibilityState === 'visible' ? 10_000 : 60_000
}
