// Shared by simulation and score API. Distances are metres.
export function calculateScore(s) {
  return Math.max(0, Math.floor(s.distance * 2 + s.rings * 150 + s.driftMeters * 4 + s.rolls * 600 + s.landings * 200 + s.nearMisses * 250 + s.gripSections * 500 + s.comboBonus));
}
export const AIR = Object.freeze({ ring: 25, boost: 16, lift: 14, side: 7, roll: 8, grip: 5 });
export const DRIFT_TIERS = Object.freeze([
  { seconds: .65, distance: 10, air: 8, turbo: .45, name: '漂亮漂移' },
  { seconds: 1.4, distance: 25, air: 16, turbo: .7, name: '超级漂移' },
  { seconds: 2.2, distance: 45, air: 24, turbo: 1, name: '极限漂移' },
]);
