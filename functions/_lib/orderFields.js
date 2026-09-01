export const ORDER_FIELDS = [
  'delivery_date', 'delivery_time', 'quantity', 'unit_price', 'customer_name', 'customer_phone',
  'deposit', 'driver', 'delivery_address',
  'tableware_veg_clip', 'tableware_veg_spoon', 'tableware_rice_spoon', 'tableware_soup_spoon',
  'tableware_bowl', 'tableware_plate', 'tableware_chopsticks', 'tableware_cup',
  'notes', 'opt_no_pork', 'opt_no_spicy', 'opt_hearty', 'opt_kids', 'opt_elderly',
];

export function normalizeOrderBody(b) {
  const out = {};
  for (const f of ORDER_FIELDS) {
    if (f.startsWith('opt_')) out[f] = b[f] ? 1 : 0;
    else if (f.startsWith('tableware_')) out[f] = Number(b[f]) || 0;
    else out[f] = b[f] ?? '';
  }
  out.quantity = Number(b.quantity) || 1;
  out.unit_price = Number(b.unit_price) || 0;
  out.deposit = Number(b.deposit) || 0;
  return out;
}
