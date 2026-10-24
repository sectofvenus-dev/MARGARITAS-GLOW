import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { callFunction, money, supabase } from '../lib/supabase';

interface OrderResult { order: { id: string; order_number: string; subtotal: number; shipping_cost?: number | null; total_amount?: number | null; status: string; payment_status: string }; bankTransfer?: { holder?: string; bank?: string; account_number?: string; instructions?: string }; nextStep?: string }
function createOrderIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
interface FormData { full_name: string; phone: string; department: string; locality: string; address: string; postal_code: string; instructions: string; company_name: string; payment_method: 'bank_transfer' | 'whatsapp_coordination' }

export function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>({ full_name: '', phone: '', department: 'Salto', locality: '', address: '', postal_code: '', instructions: '', company_name: 'La Nave', payment_method: 'bank_transfer' });
  const [transportOptions, setTransportOptions] = useState(['La Nave', 'UES', 'Norteño', 'Correo Uruguayo', 'Otra empresa']);
  const [otherCompany, setOtherCompany] = useState('');
  useEffect(() => {
    let active = true;
    if (supabase) supabase.from('shipping_companies').select('name').eq('is_active', true).order('name').then(({ data }) => {
      if (!active || !data?.length) return;
      const names = data.map((row) => row.name).filter((name) => name !== 'Otra empresa');
      setTransportOptions([...names, 'Otra empresa']);
      setForm((current) => ({ ...current, company_name: names.includes(current.company_name) ? current.company_name : (names[0] || 'Otra empresa') }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [idempotencyKey] = useState(createOrderIdempotencyKey);
  const update = (key: keyof FormData, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!items.length) { setError('Tu carrito está vacío.'); return; }
    setSending(true);
    try {
      const response = await callFunction<OrderResult>('create-order', {
        items: items.map((item) => ({ product_id: item.productId, variant_id: item.variantId, quantity: item.quantity })),
        customer: { full_name: form.full_name, phone: form.phone, department: form.department, locality: form.locality, address: form.address, postal_code: form.postal_code, instructions: form.instructions },
        shipping: { company_name: form.company_name === 'Otra empresa' && otherCompany.trim() ? `Otra empresa: ${otherCompany.trim()}` : form.company_name }, payment_method: form.payment_method, idempotency_key: idempotencyKey,
      });
      const confirmation = { ...response, customerName: form.full_name, transport: form.company_name === 'Otra empresa' && otherCompany.trim() ? `Otra empresa: ${otherCompany.trim()}` : form.company_name, paymentMethod: form.payment_method, createdAt: new Date().toISOString() };
      localStorage.setItem('mg-last-order-confirmation', JSON.stringify(confirmation));
      clear(); navigate('/pedido-confirmado', { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar el pedido. Intentá nuevamente.'); }
    finally { setSending(false); }
  }
  if (!items.length) return <main className="container page-main"><div className="empty-state"><h1>No hay productos para pedir</h1><p>Agregá tus favoritos al carrito antes de completar el pedido.</p><Link className="button button-primary" to="/catalogo">Volver al catálogo <ArrowRight size={17}/></Link></div></main>;
  return <main className="container page-main"><Link to="/carrito" className="back-link"><ArrowLeft size={17}/> Volver al carrito</Link><div className="page-title-block page-title-block--left"><span className="eyebrow">UN PASO MÁS</span><h1>Datos para tu pedido</h1><p>Completá tus datos para coordinar la entrega. El pedido todavía no es un pago confirmado.</p></div>
    <div className="checkout-layout"><form className="checkout-form" onSubmit={submit}>
      <section className="checkout-section"><div className="checkout-section__heading"><span>01</span><div><h2>¿A quién se lo enviamos?</h2><p>Usaremos estos datos para coordinar el pedido.</p></div></div><div className="form-grid form-grid--two"><label>Nombre y apellido *<input required minLength={2} maxLength={120} autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)}/></label><label>Teléfono de contacto *<input required minLength={6} maxLength={40} type="tel" autoComplete="tel" placeholder="09X XXX XXX" value={form.phone} onChange={(e) => update('phone', e.target.value)}/></label><label>Departamento *<select required value={form.department} onChange={(e) => update('department', e.target.value)}>{['Artigas','Canelones','Cerro Largo','Colonia','Durazno','Flores','Florida','Lavalleja','Maldonado','Montevideo','Paysandú','Río Negro','Rivera','Rocha','Salto','San José','Soriano','Tacuarembó','Treinta y Tres'].map((d) => <option key={d}>{d}</option>)}</select></label><label>Localidad *<input required minLength={2} maxLength={100} autoComplete="address-level2" value={form.locality} onChange={(e) => update('locality', e.target.value)} placeholder="Tu localidad"/></label><label className="form-span-two">Dirección de entrega<input maxLength={240} autoComplete="street-address" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Calle, número, apartamento (si corresponde)"/></label><label>Código postal<input maxLength={24} autoComplete="postal-code" value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)}/></label><label className="form-span-two">Indicaciones adicionales<textarea rows={3} maxLength={1000} value={form.instructions} onChange={(e) => update('instructions', e.target.value)} placeholder="Referencia para llegar, horario preferido, etc."/></label></div></section>
      <section className="checkout-section"><div className="checkout-section__heading"><span>02</span><div><h2>Transporte</h2><p>Es una preferencia; la disponibilidad y el costo se confirman luego.</p></div></div><label>Empresa de transporte<select value={form.company_name} onChange={(e) => update('company_name', e.target.value)}>{transportOptions.map((option) => <option key={option}>{option}</option>)}</select></label>{form.company_name === 'Otra empresa' && <label>Nombre de la empresa preferida<input maxLength={80} value={otherCompany} onChange={(e) => setOtherCompany(e.target.value)} placeholder="Nombre de la empresa (opcional)"/></label>}<div className="shipping-reminder"><Truck size={19}/><span><strong>Envío a confirmar</strong><small>El costo del transporte no está incluido en el subtotal de productos.</small></span></div></section>
      <section className="checkout-section"><div className="checkout-section__heading"><span>03</span><div><h2>Forma de pago</h2><p>Por ahora trabajamos con coordinación manual.</p></div></div><label className={`payment-option${form.payment_method === 'bank_transfer' ? ' is-selected' : ''}`}><input type="radio" name="payment" checked={form.payment_method === 'bank_transfer'} onChange={() => update('payment_method', 'bank_transfer')}/><span><strong>Transferencia bancaria · BROU</strong><small>Después de crear el pedido verás los datos para transferir y enviar el comprobante.</small></span></label><label className={`payment-option${form.payment_method === 'whatsapp_coordination' ? ' is-selected' : ''}`}><input type="radio" name="payment" checked={form.payment_method === 'whatsapp_coordination'} onChange={() => update('payment_method', 'whatsapp_coordination')}/><span><strong>Coordinar por WhatsApp</strong><small>Registramos tu pedido y después coordinamos los detalles por mensaje.</small></span></label></section>
      {error && <div className="error-banner" role="alert">{error}</div>}<button className="button button-primary button-full checkout-submit" disabled={sending}>{sending ? 'Registrando pedido…' : <>Confirmar pedido <ArrowRight size={18}/></>}</button><p className="secure-note"><LockKeyhole size={14}/> Los precios y el stock se verifican nuevamente al registrar el pedido.</p>
    </form><aside className="order-summary checkout-summary"><h2>Tu pedido</h2>{items.map((item) => <div className="checkout-line" key={item.cartKey}><div className="checkout-line__thumbnail">{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <img src="/images/brand-mark.png" alt=""/>}<span>{item.quantity}</span></div><div className="checkout-line__description"><strong>{item.name}</strong>{item.variantLabel && <small>{item.variantLabel}</small>}<span>{money(item.unitPrice)}</span></div><strong>{money(item.unitPrice * item.quantity)}</strong></div>)}<div className="summary-row"><span>Subtotal de productos</span><strong>{money(subtotal)}</strong></div><div className="summary-row"><span>Transporte</span><strong className="pending-label">A confirmar</strong></div><div className="summary-total"><span>Total definitivo</span><strong>A confirmar</strong></div><p className="summary-note">Al confirmar, se crea una solicitud de pedido. No se considera pagada hasta que la tienda verifique la transferencia.</p></aside></div>
  </main>;
}
