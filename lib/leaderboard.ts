import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

export const mapIds = new Set(['city', 'canyon', 'orbit']);
const localDir = path.join(process.cwd(), '.local', 'manual-v3');
const remote = process.env.VERCEL === '1' || process.env.USE_REMOTE_SCORES === '1';
export class HttpError extends Error { constructor(message: string, public status = 400) { super(message); } }
export type Score = { player: string; name: string; map: string; score: number; time: number; distance: number; rings: number; collisions: number; landings: number; driftMeters: number; drifts: number; rolls: number; nearMisses: number; gripSections: number; comboBonus: number; created: number };
type Board = { entries: Score[]; used: string[] };
type Run = { version: number; player: string; map: string; started: number; nonce: string };
const empty = (): Board => ({ entries: [], used: [] });
let localLock: Promise<unknown> = Promise.resolve();

async function secret() {
  const key = process.env.RUN_SIGNING_SECRET || process.env.BLOB_READ_WRITE_TOKEN;
  if (remote) { if (!key) throw new HttpError('排行榜存储尚未连接', 503); return key; }
  await mkdir(localDir, { recursive: true });
  const file = path.join(localDir, 'run-secret');
  try { return await readFile(file, 'utf8'); } catch {
    try { await writeFile(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    return readFile(file, 'utf8');
  }
}
export async function issueRun(map: string, player: string) {
  const payload = Buffer.from(JSON.stringify({ version: 3, map, player, started: Date.now(), nonce: randomUUID() })).toString('base64url');
  return payload + '.' + createHmac('sha256', await secret()).update(payload).digest('base64url');
}
export async function verifyRun(token: string, player: string): Promise<Run> {
  if (typeof token !== 'string' || token.length > 1024) throw new HttpError('比赛凭证无效');
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', await secret()).update(payload || '').digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new HttpError('比赛凭证无效');
  const run = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Run;
  if (run.version !== 3 || run.player !== player || !mapIds.has(run.map) || Date.now() - run.started > 604800000) throw new HttpError('比赛已过期，请重新开始');
  return run;
}
async function readBoard(map: string): Promise<{ board: Board; etag?: string }> {
  if (!remote) {
    try { return { board: JSON.parse(await readFile(path.join(localDir, map + '.json'), 'utf8')) }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; return { board: empty() }; }
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError('排行榜存储尚未连接', 503);
  const blob = await get('leaderboards/manual-v3/' + map + '.json', { access: 'private', useCache: false });
  if (!blob) return { board: empty() };
  return { board: await new Response(blob.stream).json() as Board, etag: blob.blob.etag };
}
export async function listScores(map: string) {
  const { board } = await readBoard(map);
  return board.entries.slice(0, 20).map(({ name, score, time, distance, rings, collisions, drifts, rolls }) => ({ name, score, time, distance, rings, collisions, drifts, rolls }));
}
function add(board: Board, run: Run, entry: Score): Board {
  if (board.used.includes(run.nonce)) throw new HttpError('本轮成绩已提交', 409);
  const current = board.entries.find(s => s.player === entry.player);
  const entries = current && (current.score > entry.score || current.score === entry.score && current.time <= entry.time)
    ? board.entries : [...board.entries.filter(s => s.player !== entry.player), entry];
  entries.sort((a, b) => b.score - a.score || a.time - b.time);
  return { entries: entries.slice(0, 500), used: [...board.used, run.nonce].slice(-2000) };
}
export async function saveScore(run: Run, entry: Score) {
  if (!remote) {
    const job = localLock.then(async () => {
      await mkdir(localDir, { recursive: true });
      const { board } = await readBoard(run.map), file = path.join(localDir, run.map + '.json');
      const temp = file + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify(add(board, run, entry))); await rename(temp, file);
    });
    localLock = job.catch(() => {}); return job;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const { board, etag } = await readBoard(run.map);
    try {
      await put('leaderboards/manual-v3/' + run.map + '.json', JSON.stringify(add(board, run, entry)), {
        access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60,
        allowOverwrite: !!etag, ...(etag ? { ifMatch: etag } : {}),
      });
      return;
    } catch (e) {
      // Compare-and-swap retries preserve concurrent players' scores.
      if (e instanceof HttpError) throw e;
      if (!(e instanceof BlobPreconditionFailedError) && !(e instanceof Error && /already exists/i.test(e.message))) throw e;
    }
  }
  throw new HttpError('当前提交较多，请稍后重试', 503);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host') || new URL(request.url).host;
    const parsed = new URL(origin);
    if (parsed.host !== host || !['http:', 'https:'].includes(parsed.protocol)) throw new HttpError('来源无效', 403);
  }
}
export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof HttpError ? error.message : '排行榜暂时不可用，请稍后重试' }, { status: error instanceof HttpError ? error.status : 503 });
}
