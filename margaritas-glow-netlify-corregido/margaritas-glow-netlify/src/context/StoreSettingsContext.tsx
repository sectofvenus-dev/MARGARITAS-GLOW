import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPublicSetting } from '../lib/catalog';

export interface BusinessProfile { name: string; instagram: string; phone: string; location: string; shipping_message: string }
export interface StorefrontSettings { hero_title?: string; hero_subtitle?: string; announcement?: string; show_featured?: boolean }
const defaultBusiness: BusinessProfile = { name: 'Margarita’s Glow', instagram: 'https://www.instagram.com/margaritasglow.uy/', phone: '099 782 589', location: 'Villa Constitución, Salto, Uruguay', shipping_message: 'Envíos a todo Uruguay' };
const SettingsContext = createContext<{ business: BusinessProfile; storefront: StorefrontSettings; refresh: () => void }>({ business: defaultBusiness, storefront: {}, refresh: () => undefined });
export function whatsappDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `598${digits.slice(1)}`;
  else if (!digits.startsWith('598')) digits = `598${digits}`;
  return digits;
}
export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<BusinessProfile>(defaultBusiness);
  const [storefront, setStorefront] = useState<StorefrontSettings>({});
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getPublicSetting<Partial<BusinessProfile>>('business_profile'), getPublicSetting<StorefrontSettings>('storefront')]).then(([profile, front]) => {
      if (!active) return;
      if (profile) setBusiness({ ...defaultBusiness, ...profile });
      if (front) setStorefront(front);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey]);
  const value = useMemo(() => ({ business, storefront, refresh: () => setRefreshKey((key) => key + 1) }), [business, storefront]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export function useStoreSettings() { return useContext(SettingsContext); }
export function getInstagramHandle(url: string): string {
  try { const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, ''); return pathname ? `@${pathname.split('/')[0]}` : '@margaritasglow.uy'; } catch { return '@margaritasglow.uy'; }
}
