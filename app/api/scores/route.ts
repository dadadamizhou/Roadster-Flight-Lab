import { calculateScore } from '@/public/game/rules.js';
import { checkOrigin, errorResponse, HttpError, mapIds, listScores, saveScore, verifyRun } from '@/lib/leaderboard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const map = new URL(request.url).searchParams.get('map') || '';
    if (!mapIds.has(map)) throw new HttpError('赛道不存在');
    return Response.json({ scores: await listScores(map) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const b = await request.json() as { name: string; run: string; player: string; time: number; rings: number; collisions: number; landings: number; distance: number; driftMeters: number; drifts: number; rolls: number; nearMisses: number; gripSections: number; comboBonus: number };
    if (!b || typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 16 || /[<>\x00-\x1f]/.test(b.name)) throw new HttpError('昵称请使用 1–16 个文字或数字');
    const counts = [b.rings, b.collisions, b.landings, b.drifts, b.rolls, b.nearMisses, b.gripSections, b.comboBonus];
    if (!Number.isFinite(b.time) || b.time < .05 || b.time > 604800 || !Number.isFinite(b.distance) || b.distance < 0 || b.distance > b.time * 82 + 1 || !Number.isFinite(b.driftMeters) || b.driftMeters < 0 || b.driftMeters > b.distance * 2.5 || counts.some(n => !Number.isSafeInteger(n) || n < 0)) throw new HttpError('成绩数据无效');
    const events = b.rings + b.landings + b.drifts + b.nearMisses + b.gripSections;
    if (b.rings > Math.ceil(b.distance / 30) + 2 || b.collisions > 5 || b.landings > b.time / .65 || b.drifts > b.time / .65 || b.rolls > b.time / 1.2 || b.nearMisses > Math.ceil(b.distance / 145) || b.gripSections > Math.floor(b.distance / 200) || b.comboBonus > Math.max(0, events - 1) * 400 || b.comboBonus % 100 !== 0 || (b.drifts === 0 && b.driftMeters !== 0) || (b.landings === 0 && b.rolls !== 0)) throw new HttpError('特技数据无法验证');
    const run = await verifyRun(b.run, b.player);
    if (b.time * 1000 > Date.now() - run.started + 2000) throw new HttpError('驾驶时间无法验证');
    const score = calculateScore(b);
    await saveScore(run, { player: b.player, name: b.name.trim(), map: run.map, score, time: b.time, distance: b.distance, rings: b.rings, collisions: b.collisions, landings: b.landings, driftMeters: b.driftMeters, drifts: b.drifts, rolls: b.rolls, nearMisses: b.nearMisses, gripSections: b.gripSections, comboBonus: b.comboBonus, created: Date.now() });
    return Response.json({ score });
  } catch (e) { return errorResponse(e); }
}
