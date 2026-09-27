import type { IntegrationDescriptor } from './types';

/** Integrări planificate. Niciuna nu este activă – aplicația funcționează complet manual. */
export const INTEGRATIONS: IntegrationDescriptor[] = [
  { id: 'meta', name: 'Meta Ads', kind: 'ads', description: 'Import automat spend și CPA real per produs.' },
  { id: 'google', name: 'Google Ads', kind: 'ads', description: 'Spend, conversii și ROAS per campanie/produs.' },
  { id: 'tiktok', name: 'TikTok Ads', kind: 'ads', description: 'Spend și CPA per produs.' },
  { id: 'shopify', name: 'Shopify', kind: 'orders', description: 'Comenzi reale, unități/comandă, metode de plată.' },
  { id: 'courier', name: 'Curieri', kind: 'courier', description: 'Rate reale de livrare, refuz și retur; costuri transport.' },
  { id: 'pnl', name: 'P&L zilnic', kind: 'orders', description: 'Raport actual vs. forecast, zi cu zi.' },
];
