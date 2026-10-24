import { ArrowLeft, Flower2 } from 'lucide-react';
import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return <main className="container page-main"><div className="empty-state empty-state--decorated"><div className="empty-flower"><Flower2 size={31}/></div><span className="eyebrow">UPS, NOS PERDIMOS</span><h1>Esta página no está acá.</h1><p>Quizás el enlace cambió. Volvamos a encontrar tus favoritos.</p><Link className="button button-primary" to="/"><ArrowLeft size={17}/> Volver al inicio</Link></div></main>;
}
