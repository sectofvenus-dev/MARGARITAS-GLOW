import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Instagram, Menu, MessageCircle, Search, ShoppingBag, X } from 'lucide-react';
import { Brand } from './Brand';
import { useCart } from '../context/CartContext';
import { useStoreSettings, whatsappDigits } from '../context/StoreSettingsContext';
export function Header() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { count } = useCart();
  const { business, storefront } = useStoreSettings();
  const whatsapp = whatsappDigits(business.phone);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault(); setOpen(false);
    navigate(`/catalogo${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
  };
  return <>
    <div className="announcement-bar">✨ {storefront.announcement || 'Tu próximo favorito está acá · Envíos a todo Uruguay'} ✨</div>
    <header className="site-header">
      <div className="site-header__inner container">
        <button className="icon-button mobile-menu-button" onClick={() => setOpen(!open)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'}>{open ? <X size={23} /> : <Menu size={23} />}</button>
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          <NavLink to="/" end>Inicio</NavLink><NavLink to="/catalogo">Catálogo</NavLink><NavLink to="/preguntas-frecuentes">Preguntas frecuentes</NavLink>
        </nav>
        <div className="header-actions">
          <form className="header-search" onSubmit={submitSearch} role="search">
            <Search size={17} aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" />
          </form>
          <a className="icon-button header-social" href={business.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={21}/></a>
          <a className="icon-button header-social" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={21}/></a>
          <Link className="cart-link" to="/carrito" aria-label={`Carrito, ${count} artículos`}><ShoppingBag size={22}/><span>Carrito</span><strong>{count}</strong></Link>
        </div>
      </div>
      {open && <div className="mobile-nav container">
        <NavLink onClick={() => setOpen(false)} to="/" end>Inicio</NavLink><NavLink onClick={() => setOpen(false)} to="/catalogo">Catálogo</NavLink><NavLink onClick={() => setOpen(false)} to="/preguntas-frecuentes">Preguntas frecuentes</NavLink>
        <form className="header-search mobile-search" onSubmit={submitSearch}><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos" aria-label="Buscar productos"/></form>
        <Link onClick={() => setOpen(false)} to="/carrito">Ver carrito ({count})</Link>
      </div>}
    </header>
  </>;
}
