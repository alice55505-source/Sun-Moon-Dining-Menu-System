export const BENTO_ORDER_FIELDS = [
  'delivery_date', 'meal_period', 'order_type', 'price_tier', 'vendor_name',
  'quantity', 'opt_no_pork', 'notes',
];

export function normalizeBentoOrderBody(b) {
  return {
    delivery_date: b.delivery_date ?? '',
    meal_period: b.meal_period || '午餐',
    order_type: b.order_type || '便當',
    price_tier: Number(b.price_tier) || 0,
    vendor_name: b.vendor_name ?? '',
    quantity: Number(b.quantity) || 1,
    opt_no_pork: b.opt_no_pork ? 1 : 0,
    notes: b.notes ?? '',
  };
}
