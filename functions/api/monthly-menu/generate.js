import { json, errorJson } from '../../_lib/http.js';
import { generateMonthCalendar, saveMonthCalendar } from '../../_lib/monthlyMenuGenerator.js';
import { validateMonthlyMenu, summarizeMonthRepeats } from '../../_lib/monthlyMenuRules.js';

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  const month = b.month || new Date().toISOString().slice(0, 7);

  const result = await generateMonthCalendar(env.DB, month);
  if (result.error) return errorJson(result.error);

  await saveMonthCalendar(env.DB, month, result.days);

  const days = result.days.map((day) => ({
    date: day.date,
    items: day.items,
    warnings: validateMonthlyMenu(
      day.items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it }))
    ),
  }));

  const monthSummary = summarizeMonthRepeats(
    days.map((d) => ({
      date: d.date,
      items: d.items.map((it) => ({ slot_category: it.slot_category, variant: it.variant, dish: it })),
    }))
  );

  return json({ month, days, monthSummary });
}
