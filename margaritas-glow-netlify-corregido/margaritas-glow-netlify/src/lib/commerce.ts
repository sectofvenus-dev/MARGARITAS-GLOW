export interface PricedQuantity { unitPrice: number; quantity: number }
export function calculateSubtotal(items: PricedQuantity[]): number {
  return items.reduce((total, item) => total + Math.max(0, Number(item.unitPrice) || 0) * Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
}
export function clampQuantity(requested: number, stock: number): number {
  return Math.max(0, Math.min(Math.floor(Number(requested) || 0), Math.max(0, Math.floor(Number(stock) || 0))));
}
