import { json, errorJson } from '../_lib/http.js';
import { getPurchaseListByDate } from '../_lib/purchase.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) return errorJson('date 查詢參數為必填 (YYYY-MM-DD)');
  return json(await getPurchaseListByDate(env.DB, date));
}
