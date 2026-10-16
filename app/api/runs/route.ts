import { checkOrigin, errorResponse, HttpError, issueRun, mapIds } from '@/lib/leaderboard';
export const runtime = 'nodejs';
const recent = new Map<string, { count: number; since: number }>();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const b = await request.json() as { map: string; player: string };
    if (!b || !mapIds.has(b.map) || typeof b.player !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(b.player)) throw new HttpError('参数无效');
    const now = Date.now(), last = recent.get(b.player);
    if (last && now - last.since < 60000) { if (++last.count > 15) throw new HttpError('请稍后重试', 429); }
    else recent.set(b.player, { count: 1, since: now });
    if (recent.size > 2000) for (const [key, value] of recent) if (now - value.since > 60000) recent.delete(key);
    return Response.json({ id: await issueRun(b.map, b.player) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
