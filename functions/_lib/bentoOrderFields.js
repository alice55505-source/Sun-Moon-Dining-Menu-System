export const BENTO_ORDER_FIELDS = [
  'vendor_name', 'order_month', 'meal_period', 'order_type', 'price_tier',
  'quantity', 'opt_no_pork', 'opt_soup', 'notes',
];

export function normalizeBentoOrderBody(b) {
  return {
    vendor_name: b.vendor_name ?? '',
    order_month: b.order_month ?? '',
    meal_period: b.meal_period || '午餐',
    order_type: b.order_type || '便當',
    price_tier: Number(b.price_tier) || 0,
    quantity: Number(b.quantity) || 1,
    opt_no_pork: b.opt_no_pork ? 1 : 0,
    opt_soup: b.opt_soup ? 1 : 0,
    notes: b.notes ?? '',
  };
}
