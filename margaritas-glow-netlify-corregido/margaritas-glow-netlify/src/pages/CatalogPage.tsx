import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Category, Product } from '../types';
import { getCategories, getProducts } from '../lib/catalog';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProductCard } from '../components/ProductCard';

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brand, setBrand] = useState('');
  const [availability, setAvailability] = useState('all');
  const [sort, setSort] = useState('newest');
  const [maxPrice, setMaxPrice] = useState('');
  const query = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoria') || '';
  useEffect(() => {
    let active = true;
    Promise.all([getProducts(), getCategories()]).then(([p, c]) => { if (active) { setProducts(p); setCategories(c); } })
      .catch(() => { if (active) setError('No se pudo cargar el catálogo. Revisá la conexión de Supabase.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const brands = useMemo(() => [...new Set(products.map((product) => product.brands?.name).filter((name): name is string => Boolean(name)))].sort(), [products]);
  const filtered = useMemo(() => {
    const filteredRows = products.filter((product) => {
      const text = `${product.name} ${product.brands?.name || ''} ${product.short_description || ''}`.toLocaleLowerCase('es-UY');
      if (query && !text.includes(query.toLocaleLowerCase('es-UY'))) return false;
      if (categoryId && product.categories?.id !== categoryId) return false;
      if (brand && product.brands?.name !== brand) return false;
      const variantRows = (product.product_variants ?? []).filter((item) => item.is_active);
      const totalStock = variantRows.length ? variantRows.reduce((sum, item) => sum + (product.inventory ?? []).filter((row) => row.variant_id === item.id).reduce((s, row) => s + Number(row.stock), 0), 0) : (product.inventory ?? []).filter((row) => !row.variant_id).reduce((s, row) => s + Number(row.stock), 0);
      if (availability === 'available' && totalStock <= 0) return false;
      if (availability === 'out' && totalStock > 0) return false;
      const price = Number(product.sale_price ?? product.price);
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });
    return filteredRows.sort((a,b) => sort === 'price-asc' ? Number(a.sale_price ?? a.price) - Number(b.sale_price ?? b.price) : sort === 'price-desc' ? Number(b.sale_price ?? b.price) - Number(a.sale_price ?? a.price) : sort === 'name' ? a.name.localeCompare(b.name,'es') : new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [products, query, categoryId, brand, availability, maxPrice, sort]);
  function changeSearch(value: string) { const next = new URLSearchParams(searchParams); value.trim() ? next.set('q', value) : next.delete('q'); setSearchParams(next, { replace: true }); }
  function clearFilters() { setSearchParams({}); setBrand(''); setAvailability('all'); setMaxPrice(''); }
  return <main className="page-main container">
    <div className="page-title-block"><span className="eyebrow">NUESTRO CATÁLOGO</span><h1>Encontrá tu próximo favorito.</h1><p>Maquillaje, skincare y accesorios para sumar un toque especial a tu rutina.</p></div>
    <div className="catalog-toolbar"><label className="catalog-search"><Search size={18}/><input value={query} onChange={(e) => changeSearch(e.target.value)} placeholder="Buscar producto o marca…" aria-label="Buscar producto o marca"/>{query && <button onClick={() => changeSearch('')} aria-label="Borrar búsqueda"><X size={16}/></button>}</label><label className="sort-select">Ordenar por<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Más recientes</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="name">Nombre A-Z</option></select></label></div>
    <div className="catalog-layout"><aside className="filter-panel"><div className="filter-heading"><SlidersHorizontal size={18}/><strong>Filtrar</strong><button onClick={clearFilters}>Limpiar</button></div>
      <label>Categoría<select value={categoryId} onChange={(e) => { const next = new URLSearchParams(searchParams); e.target.value ? next.set('categoria', e.target.value) : next.delete('categoria'); setSearchParams(next); }}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Marca<select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">Todas las marcas</option>{brands.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Precio máximo (UYU)<input inputMode="decimal" type="number" min="0" value={maxPrice} placeholder="Sin límite" onChange={(e) => setMaxPrice(e.target.value)}/></label>
      <label>Disponibilidad<select value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="all">Todos</option><option value="available">Con stock</option><option value="out">Agotados</option></select></label>
    </aside><section className="catalog-results"><div className="catalog-results__top"><span>{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}</span>{(query || categoryId || brand || maxPrice || availability !== 'all') && <button className="text-link" onClick={clearFilters}>Quitar filtros <X size={14}/></button>}</div>
      {loading ? <div className="loading-row"><span className="spinner"/> Cargando catálogo…</div> : error ? <div className="empty-state"><p>{error}</p><button className="button button-outline" onClick={() => window.location.reload()}>Reintentar</button></div> : filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <div className="empty-state empty-state--decorated"><div className="empty-flower">✿</div><h3>{products.length ? 'No encontramos resultados' : 'Pronto vas a encontrar tus favoritos acá'}</h3><p>{products.length ? 'Probá cambiar los filtros o buscar con otras palabras.' : isSupabaseConfigured ? 'Todavía no hay productos publicados. La tienda podrá cargarlos desde el panel administrativo.' : 'La tienda está lista para conectarse a Supabase y recibir su catálogo real.'}</p>{(query || categoryId || brand || maxPrice || availability !== 'all') && <button className="button button-outline" onClick={clearFilters}>Ver todos</button>}</div>}
    </section></div>
  </main>;
}
