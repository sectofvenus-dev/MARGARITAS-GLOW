import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`} to="/" aria-label="Margarita's Glow, inicio">
    <img src="/images/brand-mark.png" alt="" className="brand-lockup__mark" />
    <span className="brand-lockup__wordmark"><span>Margarita’s</span><em>glow</em></span>
  </Link>;
}
