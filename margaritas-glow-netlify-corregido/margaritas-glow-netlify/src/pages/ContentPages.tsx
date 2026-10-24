import { useEffect, useState } from 'react';
import { ChevronDown, MessageCircle, Truck } from 'lucide-react';
import { getPublicSetting } from '../lib/catalog';
import { useStoreSettings, whatsappDigits } from '../context/StoreSettingsContext';

interface FAQItem { question: string; answer: string }
interface PolicyValue { title?: string; content?: string; needs_review?: boolean }
const DEFAULT_FAQS: FAQItem[] = [
  { question: '¿Hacen envíos a todo Uruguay?', answer: 'Sí, coordinamos envíos a todo Uruguay. La empresa disponible y el costo dependen de la localidad; te confirmamos estos datos antes de que realices el pago definitivo.' },
  { question: '¿Qué empresas de transporte puedo elegir?', answer: 'Podés indicar tu preferencia por La Nave, UES, Norteño, Correo Uruguayo u otra empresa. La disponibilidad se confirma al coordinar el pedido.' },
  { question: '¿Cuándo queda confirmado mi pedido?', answer: 'Cuando recibimos la solicitud, verificamos los productos y coordinamos el envío. Si elegiste transferencia, el pedido no figura como pagado hasta que la tienda compruebe el pago.' },
  { question: '¿Cómo envío el comprobante?', answer: 'Después de realizar la transferencia, podés escribirnos por WhatsApp y adjuntar el comprobante. Abrir el enlace no envía un mensaje automáticamente: tenés que enviarlo desde WhatsApp.' },
  { question: '¿Puedo consultar por un producto antes de comprar?', answer: '¡Claro! Escribinos por WhatsApp o Instagram y te ayudamos a consultar disponibilidad y características.' },
];

export function FAQPage() {
  const { business } = useStoreSettings();
  const [items, setItems] = useState<FAQItem[]>(DEFAULT_FAQS);
  useEffect(() => { getPublicSetting<{ items?: FAQItem[] }>('faq').then((value) => { if (value?.items?.length) setItems(value.items); }).catch(() => undefined); }, []);
  return <main className="container page-main content-page"><div className="page-title-block"><span className="eyebrow">TE ACOMPAÑAMOS</span><h1>Preguntas frecuentes</h1><p>Información para que compres con tranquilidad.</p></div><div className="faq-layout"><section className="faq-list">{items.map((item, index) => <details className="faq-item" key={`${item.question}-${index}`}><summary><span>{item.question}</span><ChevronDown size={19}/></summary><p>{item.answer}</p></details>)}</section><aside className="faq-contact"><div className="faq-contact__icon"><MessageCircle size={25}/></div><h2>¿Te quedó alguna duda?</h2><p>Escribinos, estamos para ayudarte a elegir.</p><a className="button button-primary" href={`https://wa.me/${whatsappDigits(business.phone)}?text=${encodeURIComponent("Hola Margarita’s Glow, tengo una consulta.")}`} target="_blank" rel="noreferrer">Consultar por WhatsApp <MessageCircle size={16}/></a><div className="faq-contact__note"><Truck size={16}/> Envíos a todo Uruguay</div></aside></div></main>;
}

const POLICY_DEFAULTS: Record<string, { title: string; content: string }> = {
  privacidad: { title: 'Política de privacidad', content: 'Este documento es una plantilla inicial y debe revisarse antes de publicar. La tienda debe explicar qué datos personales recoge durante un pedido, para qué los utiliza, cuánto tiempo los conserva, con quién los comparte para coordinar la entrega y cómo una persona puede ejercer sus derechos.\n\nNo agregues información que no refleje las prácticas reales del negocio. Completá y validá este texto con asesoramiento adecuado antes de habilitar las ventas.' },
  condiciones: { title: 'Condiciones de compra', content: 'Este documento es una plantilla inicial y necesita revisión antes de publicar. Debe describir cómo se crea un pedido, cuándo se confirma, cómo se informan los precios, cuándo se define el costo del envío, qué métodos de pago están realmente disponibles y cómo se comunica el estado de cada compra.\n\nLa creación de una solicitud no significa que el pago esté confirmado ni que el pedido ya haya sido enviado.' },
  cambios: { title: 'Cambios y devoluciones', content: 'Este documento es una plantilla inicial y debe revisarse para ajustarse a la normativa aplicable y a las prácticas reales del emprendimiento. Definí de forma clara cómo se gestionan los reclamos, los productos dañados o incorrectos, los plazos, las condiciones de devolución y el canal de contacto.\n\nNo publiques plazos ni excepciones que la tienda no pueda cumplir.' },
};

export function PolicyPage({ kind }: { kind: 'privacidad' | 'condiciones' | 'cambios' }) {
  const { business } = useStoreSettings();
  const [policy, setPolicy] = useState<PolicyValue | null>(null);
  useEffect(() => {
    const key = kind === 'privacidad' ? 'policy_privacy' : kind === 'condiciones' ? 'policy_terms' : 'policy_returns';
    getPublicSetting<PolicyValue>(key).then(setPolicy).catch(() => undefined);
  }, [kind]);
  const fallback = POLICY_DEFAULTS[kind];
  const content = policy?.content || fallback.content;
  return <main className="container page-main content-page policy-page"><div className="page-title-block"><span className="eyebrow">INFORMACIÓN DE LA TIENDA</span><h1>{policy?.title || fallback.title}</h1><p>Última revisión: pendiente de definir por la tienda.</p></div>{(policy?.needs_review !== false || !policy?.content) && <div className="policy-review-note"><strong>Antes de publicar:</strong> este texto requiere revisión y adaptación a las condiciones reales del negocio y a la normativa vigente.</div>}<article className="policy-copy">{content.split('\n').map((paragraph, index) => paragraph.trim() ? <p key={index}>{paragraph}</p> : <div className="policy-gap" key={index}/>)}</article><a className="text-link" href={`https://wa.me/${whatsappDigits(business.phone)}`} target="_blank" rel="noreferrer">¿Tenés una consulta? Escribinos por WhatsApp <MessageCircle size={16}/></a></main>;
}
