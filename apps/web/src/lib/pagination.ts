import { api } from './api';
import type { Paginated } from './types';

/** Load complete option lists/history; primary tables use server pagination. */
export async function fetchAll<T>(url: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await api.get<Paginated<T>>(url, {
      params: { page, limit: 100 },
    });
    rows.push(...data.data);
    if (page * data.meta.limit >= data.meta.total || data.data.length === 0)
      return rows;
  }
}
