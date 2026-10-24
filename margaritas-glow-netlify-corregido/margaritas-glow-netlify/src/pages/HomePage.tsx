import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, Heart, PackageCheck, Sparkles, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Category, Product } from '../types';
import { getCategories, getProducts } from '../lib/catalog';
import { useStoreSettings, whatsappDigits } from '../context/StoreSettingsContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ProductCard } from '../components/ProductCard';

interface HomeReview { id: string; display_name: string; rating: number; comment: string; is_verified_purchase: boolean }
interface HomeCampaign { id: string; title: string; description: string | null }

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<HomeReview[]>([]);
  const [campaigns, setCampaigns] = useState<HomeCampaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { business, storefront: settings } = useStoreSettings();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getProducts({ featured: true }), getProducts(), getCategories()])
      .then(([featuredData, allProducts, categoryData]) => { if (active) { setProducts(featuredData); setPromotions(allProducts.filter((product) => (product.sale_price !== null && product.sale_price !== undefined && Number(product.sale_price) < Number(product.price)) || product.categories?.slug === 'combos').slice(0, 4)); setCategories(categoryData); } })
      .catch(() => { if (active) setLoadError('No pudimos cargar el catálogo. Revisá la conexión e intentá nuevamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase.from('reviews').select('id,display_name,rating,comment,is_verified_purchase').eq('is_approved', true).order('created_at', { ascending: false }).limit(3),
      supabase.from('promotions').select('id,title,description').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    ]).then(([reviewResult, campaignResult]) => {
      if (!active) return;
      if (!reviewResult.error) setReviews((reviewResult.data ?? []) as HomeReview[]);
      if (!campaignResult.error) setCampaigns((campaignResult.data ?? []) as HomeCampaign[]);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <main>
    <section className="hero container">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/> UN TOQUE DE MAGIA PARA VOS</span><h1>{settings?.hero_title || 'Tu próximo favorito está acá'}<span className="hero-flower">✿</span></h1><p>{settings?.hero_subtitle || 'Un espacio pensado para quienes aman el maquillaje tanto como nosotras. Encontrá esos pequeños detalles que te hacen sentir increíble.'}</p><div className="hero-buttons"><Link className="button button-primary" to="/catalogo">Explorar catálogo <ArrowRight size={18}/></Link><a className="button button-ghost" href={business.instagram} target="_blank" rel="noreferrer">Conocenos en Instagram</a></div><div className="hero-note"><Heart size={16} fill="currentColor"/> Productos elegidos con cariño, para vos.</div></div>
      <div className="hero-art" aria-label="Identidad visual de Margarita's Glow"><div className="hero-orbit hero-orbit--one"/><div className="hero-orbit hero-orbit--two"/><span className="hero-doodle hero-doodle--a">✿</span><span className="hero-doodle hero-doodle--b">✧</span><div className="hero-seal"><img src="/images/brand-mark.png" alt="Logotipo de Margarita's Glow"/><span>BEAUTY · MAKEUP · LOVE</span></div><div className="hero-sticker hero-sticker--top">un mimo<br/>para vos <span>♡</span></div><div className="hero-sticker hero-sticker--bottom">glow your way ✨</div></div>
    </section>
    <section className="trust-strip"><div className="container trust-grid"><div><Truck/><span><strong>Envíos a todo Uruguay</strong><small>Coordinamos el transporte con vos</small></span></div><div><PackageCheck/><span><strong>Compra acompañada</strong><small>Te ayudamos si tenés dudas</small></span></div><div><Heart/><span><strong>Elegido con cariño</strong><small>Detalles que enamoran</small></span></div></div></section>
    <section className="section container"><div className="section-heading"><div><span className="eyebrow">ENCONTRÁ TU FAVORITO</span><h2>Explorá por categoría</h2><p>Un rinconcito para cada parte de tu rutina.</p></div><Link className="text-link" to="/catalogo">Ver todo <ArrowRight size={16}/></Link></div>
      {categories.length ? <div className="category-grid">{categories.map((category, index) => <Link className={`category-tile category-tile--${index % 4}`} to={`/catalogo?categoria=${category.id}`} key={category.id}><span className="category-tile__index">0{index + 1}</span><span>{category.name}</span><ArrowDown size={17}/></Link>)}</div> : <div className="soft-note">{isSupabaseConfigured ? 'Las categorías aparecerán cuando se conecte el catálogo.' : 'Configurá Supabase para publicar las categorías de la tienda.'}</div>}
    </section>
    {settings?.show_featured !== false && <section className="section featured-section"><div className="container"><div className="section-heading"><div><span className="eyebrow">SELECCIÓN MARGARITA’S</span><h2>Favoritos de la tienda</h2><p>Novedades y productos destacados, cargados directamente desde el panel.</p></div><Link className="text-link" to="/catalogo">Explorar catálogo <ArrowRight size={16}/></Link></div>
      {loading ? <div className="loading-row"><span className="spinner"/> Preparando el catálogo…</div> : loadError ? <div className="empty-state"><p>{loadError}</p><button className="button button-outline" onClick={() => window.location.reload()}>Volver a intentar</button></div> : products.length ? <div className="product-grid">{products.slice(0,4).map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="empty-state empty-state--decorated"><div className="empty-flower">✿</div><h3>Este espacio espera tus favoritos</h3><p>Los productos destacados aparecerán aquí cuando se carguen desde el panel administrativo. No mostramos productos ni precios inventados.</p><Link className="button button-outline" to="/catalogo">Ver catálogo <ArrowRight size={17}/></Link>{!isSupabaseConfigured && <small>La conexión con Supabase todavía no está configurada.</small>}</div>}
    </div></section>}
    {promotions.length > 0 && <section className="section container"><div className="section-heading"><div><span className="eyebrow">OPORTUNIDADES PARA VOS</span><h2>Promos y combos</h2><p>Precios promocionales y combos cargados en el catálogo.</p></div><Link className="text-link" to="/catalogo">Ver todo <ArrowRight size={16}/></Link></div><div className="product-grid">{promotions.map((product) => <ProductCard key={product.id} product={product}/>)}</div></section>}
    {campaigns.length > 0 && <section className="section container"><div className="section-heading"><div><span className="eyebrow">NOVEDADES DE LA TIENDA</span><h2>Promociones vigentes</h2><p>Información publicada desde el panel de administración.</p></div></div><div className="campaign-promotion-grid">{campaigns.map((campaign) => <article className="campaign-promotion-card" key={campaign.id}><span className="campaign-promotion-card__flower">✿</span><h3>{campaign.title}</h3>{campaign.description && <p>{campaign.description}</p>}<Link className="text-link" to="/catalogo">Explorar catálogo <ArrowRight size={15}/></Link></article>)}</div></section>}
    <section className="section container homepage-reviews"><div className="section-heading"><div><span className="eyebrow">EXPERIENCIAS REALES</span><h2>Lo que cuentan nuestras clientas</h2><p>Opiniones publicadas después de la revisión de la tienda.</p></div></div>{reviews.length ? <div className="review-grid">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div><p>“{review.comment}”</p><div className="review-byline"><strong>{review.display_name}</strong>{review.is_verified_purchase && <span>Compra verificada</span>}</div></article>)}</div> : <div className="soft-note">Todavía no hay opiniones publicadas. Cuando haya reseñas reales y sean aprobadas, aparecerán en este espacio.</div>}</section>
    <section className="brand-note container"><div className="brand-note__decor">M<span>✿</span></div><div><span className="eyebrow">DE NUESTRO RINCÓN AL TUYO</span><h2>Un pequeño mimo también cuenta.</h2><p>Gracias por acompañar este emprendimiento que nació con ganas de acercarte cosméticos lindos, de buena calidad y a precios accesibles.</p><a className="text-link" href={business.instagram} target="_blank" rel="noreferrer">Seguinos en Instagram <ArrowRight size={16}/></a></div></section>
    <section className="newsletter-banner"><div className="container newsletter-banner__inner"><div><span className="eyebrow">¿CHARLAMOS?</span><h2>¿Tenés una consulta?</h2><p>Escribinos y te ayudamos a elegir tu próximo favorito.</p></div><a className="button button-light" href={`https://wa.me/${whatsappDigits(business.phone)}?text=${encodeURIComponent("Hola Margarita’s Glow, tengo una consulta sobre la tienda.")}`} target="_blank" rel="noreferrer">Hablemos por WhatsApp <ArrowRight size={17}/></a></div></section>
  </main>;
}
