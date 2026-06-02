'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, AuthUser } from '@/lib/auth';

export function AuthGuard({ children }: { readonly children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | 'loading'>('loading');
  const router = useRouter();

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      if (globalThis.window !== undefined) {
        const current = globalThis.location.pathname;
        if (current !== '/login') {
          sessionStorage.setItem('pk_intended', current);
        }
      }
      router.replace('/login');
      return;
    }
    setUser(u);
  }, [router]);

  if (user === 'loading' || user === null) return null;
  return <>{children}</>;
}
