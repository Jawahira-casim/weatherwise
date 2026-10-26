'use client';

import { useEffect } from 'react';

// Registers the service worker in production only, so it never serves stale files during `npm run dev`.
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service worker registration failed:', err);
    });
  }, []);

  return null;
}
