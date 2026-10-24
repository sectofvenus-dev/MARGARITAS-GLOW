import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { Product } from '../types';
import { getProduct, imageForProduct, priceForVariant, stockForProduct } from '../lib/catalog';
import { isSupabaseConfigured, money, supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useStoreSettings, whatsappDigits } from '../context/StoreSettingsContext';

interface Review { id: string; display_name: string; rating: number; comment: string; created_at: string; is_verified_purchase: boolean }
export function ProductPage() {
  const { slug = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [reviewForm, setReviewForm] = useState({ display_name: '', rating: '5', comment: '', order_number: '', phone: '' });
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSending, setReviewSending] = useState(false);
  const { add } = useCart();
  const { business } = useStoreSettings();
  useEffect(() => {
    let active = true;
    setLoading(true);
    getProduct(slug).then((data) => { if (active) { setProduct(data); if (!data) setError('No encontramos ese producto o ya no está publicado.'); } })
      .catch(() => { if (active) setError('No pudimos consultar el producto. Revisá la conexión.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    let active = true;
    if (supabase && product) supabase.from('reviews').select('id,display_name,rating,comment,created_at,is_verified_purchase').eq('product_id', product.id).eq('is_approved', true).order('created_at', { ascending: false }).then(({ data }) => { if (active) setReviews((data ?? []) as Review[]); });
    return () => { active = false; };
  }, [product]);
  const variants = (product?.product_variants ?? []).filter((item) => item.is_active);
  const chosenVariantId = variantId || (variants.length === 1 ? variants[0].id : '');
  const stock = product ? stockForProduct(product, variants.length ? (chosenVariantId || null) : null) : 0;
  const price = product ? priceForVariant(product, chosenVariantId || null) : 0;
  const image = product ? imageForProduct(product) : null;
  function addToCart() { if (!product || (variants.length > 0 && !chosenVariantId) || stock <= 0) return; add(product, chosenVariantId || null, quantity); setAdded(true); window.setTimeout(() => setAdded(false), 2500); }
  async function submitReview(event: FormEvent) {
    event.preventDefault(); if (!product) return;
    setReviewSending(true); setReviewMessage('');
    try {
      const response = await fetch('/.netlify/functions/create-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: product.id, ...reviewForm, rating: Number(reviewForm.rating), website: '' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo enviar la reseña.');
      setReviewMessage(result.message); setReviewForm({ display_name: '', rating: '5', comment: '', order_number: '', phone: '' });
    } catch (err) { setReviewMessage(err instanceof Error ? err.message : 'No se pudo enviar la reseña.'); }
    finally { setReviewSending(false); }
  }
  if (loading) return <main className="container page-main"><div className="loading-row"><span className="spinner"/> Cargando producto…</div></main>;
  if (!product) return <main className="container page-main"><div className="empty-state"><h2>Este producto no está disponible</h2><p>{error || (!isSupabaseConfigured ? 'La tienda necesita configurar Supabase.' : 'Podés volver al catálogo para seguir mirando.')}</p><Link className="button button-primary" to="/catalogo"><ArrowLeft size={17}/> Volver al catálogo</Link></div></main>;
  return <main className="container page-main product-detail-page">
    <Link to="/catalogo" className="back-link"><ArrowLeft size={17}/> Volver al catálogo</Link>
    <div className="product-detail"><div className="product-detail__visual"><div className="product-detail__image">{image ? <img src={image} alt={product.name}/> : <div className="product-placeholder product-placeholder--large"><img src="/images/brand-mark.png" alt=""/><span>Margarita’s Glow</span></div>}</div>{(product.product_images ?? []).length > 1 && <div className="image-caption">Fotos del producto</div>}</div>
      <div className="product-detail__info"><div className="product-breadcrumb">{product.categories?.name || 'Belleza'}{product.brands?.name ? ` · ${product.brands.name}` : ''}</div><h1>{product.name}</h1>{product.short_description && <p className="product-lead">{product.short_description}</p>}
        <div className="detail-price">{money(price)}{product.sale_price !== null && product.sale_price !== undefined && !chosenVariantId && <del>{money(product.price)}</del>}</div>
        {product.description && <div className="product-description">{product.description}</div>}
        {variants.length > 0 && <label className="variant-picker">Elegí una opción<select value={chosenVariantId} onChange={(e) => { setVariantId(e.target.value); setQuantity(1); }}><option value="">Seleccionar variante…</option>{variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.label}{stockForProduct(product, variant.id) <= 0 ? ' · Agotado' : ''}{variant.price_override !== null && variant.price_override !== undefined ? ` · ${money(variant.price_override)}` : ''}</option>)}</select></label>}
        <div className={`availability ${stock > 0 ? 'is-available' : 'is-unavailable'}`}><span className="availability-dot"/>{stock > 0 ? `${stock} disponible${stock === 1 ? '' : 's'}` : 'Sin stock disponible'}</div>
        <div className="purchase-row"><div className="quantity-control"><button aria-label="Disminuir cantidad" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16}/></button><span>{quantity}</span><button aria-label="Aumentar cantidad" disabled={quantity >= stock} onClick={() => setQuantity(Math.min(stock, quantity + 1))}><Plus size={16}/></button></div><button className="button button-primary button-add" disabled={stock <= 0 || (variants.length > 0 && !chosenVariantId)} onClick={addToCart}>{added ? <><Check size={17}/> Agregado al carrito</> : <>Agregar al carrito <span>{money(price * quantity)}</span></>}</button></div>
        {added && <p className="inline-success">¡Listo! El producto quedó en tu carrito.</p>}
        <div className="detail-promises"><div><Truck/><span><strong>Envíos a todo Uruguay</strong><small>El costo se confirma antes de cerrar el pago.</small></span></div><div><ShieldCheck/><span><strong>Compra acompañada</strong><small>Consultanos por WhatsApp si tenés dudas.</small></span></div></div>
        <a className="text-link" href={`https://wa.me/${whatsappDigits(business.phone)}?text=${encodeURIComponent(`Hola Margarita's Glow, quisiera consultar por ${product.name}.`)}`} target="_blank" rel="noreferrer">¿Tenés una consulta sobre este producto? <Heart size={16}/></a>
      </div></div>
    <section className="reviews-section"><div className="section-heading"><div><span className="eyebrow">EXPERIENCIAS REALES</span><h2>Opiniones de la comunidad</h2><p>Las reseñas se publican después de una revisión.</p></div><span className="review-count">{reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}</span></div>
      {reviews.length ? <div className="review-grid">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div><p>“{review.comment}”</p><div className="review-byline"><strong>{review.display_name}</strong>{review.is_verified_purchase && <span>Compra verificada</span>}</div></article>)}</div> : <div className="soft-note">Todavía no hay opiniones publicadas para este producto. Podés dejar la tuya abajo.</div>}
      <form className="review-form" onSubmit={submitReview}><h3>Dejá tu opinión</h3><div className="form-grid form-grid--two"><label>Tu nombre o seudónimo<input required minLength={2} maxLength={60} value={reviewForm.display_name} onChange={(e) => setReviewForm({ ...reviewForm, display_name: e.target.value })}/></label><label>Puntuación<select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}><option value="5">★★★★★ · Me encantó</option><option value="4">★★★★☆ · Muy bueno</option><option value="3">★★★☆☆ · Está bien</option><option value="2">★★☆☆☆ · No era lo que esperaba</option><option value="1">★☆☆☆☆ · No me gustó</option></select></label></div><label>Tu comentario<textarea required minLength={5} maxLength={1200} rows={3} value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Contanos tu experiencia…"/></label><details className="verification-details"><summary>¿Compraste este producto en la tienda?</summary><p>Podés completar estos datos para que la tienda compruebe si corresponde marcar tu opinión como compra verificada.</p><div className="form-grid form-grid--two"><label>Número de pedido<input value={reviewForm.order_number} onChange={(e) => setReviewForm({ ...reviewForm, order_number: e.target.value })}/></label><label>Teléfono usado en el pedido<input value={reviewForm.phone} onChange={(e) => setReviewForm({ ...reviewForm, phone: e.target.value })}/></label></div></details><button className="button button-primary" type="submit" disabled={reviewSending}>{reviewSending ? 'Enviando…' : 'Enviar opinión'}</button>{reviewMessage && <p className="form-message" role="status">{reviewMessage}</p>}</form>
    </section>
  </main>;
}
