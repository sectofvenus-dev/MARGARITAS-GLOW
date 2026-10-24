import { ArrowUpRight, Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../types';
import { imageForProduct, priceForVariant, stockForProduct } from '../lib/catalog';
import { money } from '../lib/supabase';
import { useCart } from '../context/CartContext';

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const image = imageForProduct(product);
  const hasVariants = (product.product_variants ?? []).some((item) => item.is_active);
  const stock = hasVariants ? (product.product_variants ?? []).filter((v) => v.is_active).reduce((sum, variant) => sum + stockForProduct(product, variant.id), 0) : stockForProduct(product);
  const price = priceForVariant(product);
  const oldPrice = product.sale_price !== null && product.sale_price !== undefined;
  return <article className="product-card">
    <Link to={`/producto/${product.slug}`} className="product-card__image-link" aria-label={`Ver ${product.name}`}>
      <div className="product-card__image">
        {image ? <img src={image} alt={product.product_images?.[0]?.alt_text || product.name} loading="lazy"/> : <div className="product-placeholder"><img src="/images/brand-mark.png" alt=""/><span>Margarita’s Glow</span></div>}
        {oldPrice && <span className="product-badge">Promo</span>}
        <span className="product-quick"><ArrowUpRight size={18}/></span>
      </div>
    </Link>
    <div className="product-card__body">
      <div className="product-meta">{product.brands?.name || product.categories?.name || 'Belleza'}</div>
      <Link to={`/producto/${product.slug}`} className="product-title">{product.name}</Link>
      <div className="product-price-row"><div><strong>{money(price)}</strong>{oldPrice && <del>{money(product.price)}</del>}</div>
        <button className="round-add" aria-label={hasVariants ? `Elegir variante de ${product.name}` : `Agregar ${product.name} al carrito`} title={hasVariants ? 'Elegir variante' : 'Agregar al carrito'} disabled={stock <= 0} onClick={() => hasVariants ? window.location.assign(`/producto/${product.slug}`) : add(product)}>{hasVariants ? <Heart size={17}/> : <ShoppingBag size={17}/>}</button>
      </div>
      {stock <= 0 && <span className="stock-note">Agotado</span>}
    </div>
  </article>;
}
