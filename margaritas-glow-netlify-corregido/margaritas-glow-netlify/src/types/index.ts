export interface Category { id: string; name: string; slug: string; description?: string | null; is_active?: boolean; sort_order?: number }
export interface ProductVariant { id: string; label: string; sku?: string | null; price_override?: number | null; is_active: boolean; sort_order?: number }
export interface InventoryRow { id?: string; stock: number; variant_id?: string | null }
export interface Product {
  id: string; sku?: string | null; name: string; slug: string; short_description?: string | null; description?: string | null;
  price: number; sale_price?: number | null; is_published: boolean; is_featured: boolean; created_at?: string;
  categories?: Category | null; brands?: { id: string; name: string } | null;
  product_images?: Array<{ id?: string; image_url: string; alt_text?: string | null; position?: number }>;
  product_variants?: ProductVariant[]; inventory?: InventoryRow[];
}
export interface CartLine {
  cartKey: string; productId: string; variantId: string | null; name: string; imageUrl: string | null;
  variantLabel: string | null; unitPrice: number; quantity: number; stock: number;
}
export type OrderStatus = 'pending_confirmation' | 'pending_payment' | 'payment_confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'proof_received' | 'confirmed' | 'rejected' | 'refunded';
export interface OrderItem { id: string; product_name_snapshot: string; variant_label_snapshot?: string | null; unit_price: number; quantity: number; line_total: number; }
export interface OrderRecord {
  id: string; order_number: string; status: OrderStatus; payment_status: PaymentStatus; payment_method: string;
  subtotal: number; shipping_cost?: number | null; total_amount?: number | null; shipping_company_name: string;
  created_at: string; tracking_number?: string | null; internal_notes?: string | null;
  customers?: { full_name: string; phone: string; department: string; locality: string; address?: string | null; postal_code?: string | null; instructions?: string | null };
  order_items?: OrderItem[]; payments?: Array<{ status: PaymentStatus; amount: number }>;
}
