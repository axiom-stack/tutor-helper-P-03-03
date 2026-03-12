import { getOfflineDb } from './db';

export async function putReference<T>(
  cacheKey: string,
  kind: string,
  payload: T,
  serverId?: string | number | null
) {
  const db = await getOfflineDb();
  await db.put('references', {
    cache_key: cacheKey,
    kind,
    server_id: serverId ?? null,
    payload,
    updated_at: new Date().toISOString(),
  });
}

export async function getReference<T>(cacheKey: string): Promise<T | null> {
  const db = await getOfflineDb();
  const record = await db.get('references', cacheKey);
  return (record?.payload as T | undefined) ?? null;
}

