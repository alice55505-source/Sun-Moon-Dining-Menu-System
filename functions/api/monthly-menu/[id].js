import { json } from '../../_lib/http.js';

export async function onRequestDelete({ params, env }) {
  await env.DB.prepare('DELETE FROM monthly_menu_items WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
