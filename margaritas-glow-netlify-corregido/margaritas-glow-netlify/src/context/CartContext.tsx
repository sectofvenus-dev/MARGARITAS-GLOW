import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartLine, Product } from '../types';
import { imageForProduct, priceForVariant, stockForProduct } from '../lib/catalog';
import { calculateSubtotal, clampQuantity } from '../lib/commerce';

interface CartContextValue {
  items: CartLine[]; count: number; subtotal: number;
  add: (product: Product, variantId?: string | null, quantity?: number) => void;
  setQuantity: (cartKey: string, quantity: number) => void;
  remove: (cartKey: string) => void; clear: () => void;
}
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'margaritas-glow-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as CartLine[];
      return Array.isArray(parsed) ? parsed.filter((line) => line && typeof line.productId === 'string' && Number.isFinite(line.quantity) && line.quantity > 0) : [];
    } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);
  const add = useCallback((product: Product, variantId: string | null = null, quantity = 1) => {
    const cartKey = `${product.id}:${variantId ?? 'default'}`;
    const stock = stockForProduct(product, variantId);
    if (stock <= 0) return;
    const variant = product.product_variants?.find((item) => item.id === variantId);
    setItems((current) => {
      const existing = current.find((item) => item.cartKey === cartKey);
      if (existing) return current.map((item) => item.cartKey === cartKey ? { ...item, quantity: clampQuantity(item.quantity + quantity, stock), stock, unitPrice: priceForVariant(product, variantId) } : item);
      return [...current, { cartKey, productId: product.id, variantId, name: product.name, imageUrl: imageForProduct(product), variantLabel: variant?.label ?? null, unitPrice: priceForVariant(product, variantId), quantity: clampQuantity(quantity, stock), stock }];
    });
  }, []);
  const setQuantity = useCallback((cartKey: string, quantity: number) => {
    if (quantity < 1) { setItems((current) => current.filter((item) => item.cartKey !== cartKey)); return; }
    setItems((current) => current.map((item) => item.cartKey === cartKey ? { ...item, quantity: clampQuantity(quantity, item.stock) } : item));
  }, []);
  const remove = useCallback((cartKey: string) => setItems((current) => current.filter((item) => item.cartKey !== cartKey)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, count: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: calculateSubtotal(items), add, setQuantity, remove, clear }), [items, add, setQuantity, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart debe utilizarse dentro de CartProvider.');
  return value;
}
