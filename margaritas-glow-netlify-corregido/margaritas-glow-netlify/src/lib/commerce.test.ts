import { describe, expect, it } from 'vitest';
import { calculateSubtotal, clampQuantity } from './commerce';

describe('commerce helpers', () => {
  it('calculates a subtotal from unit prices and quantities', () => {
    expect(calculateSubtotal([{ unitPrice: 185, quantity: 2 }, { unitPrice: 95, quantity: 3 }])).toBe(655);
  });
  it('does not calculate negative prices or quantities', () => {
    expect(calculateSubtotal([{ unitPrice: -99, quantity: 4 }, { unitPrice: 200, quantity: -2 }])).toBe(0);
  });
  it('clamps quantity to available stock', () => {
    expect(clampQuantity(7, 3)).toBe(3);
    expect(clampQuantity(2.8, 5)).toBe(2);
    expect(clampQuantity(2, 0)).toBe(0);
  });
});
