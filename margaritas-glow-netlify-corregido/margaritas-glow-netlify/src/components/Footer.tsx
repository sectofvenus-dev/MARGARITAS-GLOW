import { Instagram, MessageCircle, MapPin, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { getInstagramHandle, useStoreSettings, whatsappDigits } from '../context/StoreSettingsContext';

export function Footer() {
  const { business } = useStoreSettings();
  const whatsapp = whatsappDigits(business.phone);
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-brand"><Brand/><p>Maquillaje, belleza y accesorios elegidos con cariño. 💗</p></div>
      <div><h3>Explorá</h3><Link to="/catalogo">Todos los productos</Link><Link to="/preguntas-frecuentes">Preguntas frecuentes</Link><Link to="/privacidad">Privacidad</Link><Link to="/condiciones">Condiciones de compra</Link><Link to="/cambios-y-devoluciones">Cambios y devoluciones</Link></div>
      <div><h3>Hablemos</h3><a href={business.instagram} target="_blank" rel="noreferrer"><Instagram size={16}/> {getInstagramHandle(business.instagram)}</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp · {business.phone}</a><span><MapPin size={16}/> {business.location}</span><span><Truck size={16}/> {business.shipping_message}</span></div>
    </div>
    <div className="container footer-bottom"><span>© {new Date().getFullYear()} Margarita’s Glow</span><span>Hecho con cariño en Uruguay · <Link to="/admin">Administración</Link></span></div>
  </footer>;
}
