/**
 * Shared cursor-pagination helpers.
 *
 * Every list endpoint takes `?limit=` (default 100, max 500) and
 * `?cursor=` (the last seen id). Response carries `nextCursor`
 * (or null when the page is the final one).
 */

export interface PageParams {
  limit: number;
  cursor: string | null;
}

export function readPageParams(url: URL, opts?: { defaultLimit?: number; max?: number }): PageParams {
  const def = opts?.defaultLimit ?? 100;
  const max = opts?.max ?? 500;
  const rawLimit = Number(url.searchParams.get("limit") ?? def);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), max) : def;
  const cursor = url.searchParams.get("cursor");
  return { limit, cursor: cursor && cursor.length > 0 ? cursor : null };
}

/** Wraps a Prisma findMany call with cursor-based pagination.
 *  Returns the slice + the `nextCursor` (or null). */
export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

export function paginateSlice<T extends { id: string }>(
  rows: T[],
  limit: number,
): PaginatedResult<T> {
  // We always fetch limit+1 so we know if there's another page.
  if (rows.length > limit) {
    const slice = rows.slice(0, limit);
    return { data: slice, nextCursor: slice[slice.length - 1]!.id };
  }
  return { data: rows, nextCursor: null };
}
