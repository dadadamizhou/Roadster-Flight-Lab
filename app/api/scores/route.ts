import { checkOrigin, errorResponse, HttpError, lengths, listScores, saveScore, verifyRun } from '@/lib/leaderboard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const map = new URL(request.url).searchParams.get('map') || '';
    if (!lengths[map]) throw new HttpError('赛道不存在');
    return Response.json({ scores: await listScores(map) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const b = await request.json() as { name: string; run: string; player: string; time: number; rings: number; collisions: number; landings: number };
    if (!b || typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 16 || /[<>\x00-\x1f]/.test(b.name)) throw new HttpError('昵称请使用 1–16 个文字或数字');
    if (!Number.isFinite(b.time) || b.time < 20 || b.time > 3600 || !Number.isInteger(b.rings) || b.rings < 0 || b.rings > 12 || !Number.isInteger(b.collisions) || b.collisions < 0 || b.collisions > 999 || !Number.isInteger(b.landings) || b.landings < 0 || b.landings > 12) throw new HttpError('成绩数据无效');
    const run = await verifyRun(b.run, b.player);
    if (b.time < lengths[run.map] / 82 || b.time * 1000 > Date.now() - run.started + 2000) throw new HttpError('通关时间无法验证');
    const score = Math.max(0, Math.round(15000 - b.time * 35 + b.rings * 800 + b.landings * 250 - b.collisions * 650));
    await saveScore(run, { player: b.player, name: b.name.trim(), map: run.map, score, time: b.time, rings: b.rings, collisions: b.collisions, landings: b.landings, created: Date.now() });
    return Response.json({ score });
  } catch (e) { return errorResponse(e); }
}
