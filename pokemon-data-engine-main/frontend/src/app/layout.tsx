import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/ui/Navbar';
import { BattleTransition } from '@/components/ui/BattleTransition';
import { MobileNav } from '@/components/ui/MobileNav';

export const metadata: Metadata = {
  title: 'Pokémon Data Engine',
  description: 'Gym team generation, counter-picking, and battle prediction',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ display: 'flex', minHeight: '100dvh', background: 'var(--pk-bg)', color: 'var(--pk-text)', fontFamily: 'var(--font-body)' }}>
        {/* Global LCD/CRT scanline overlay — pointer-events:none so it never blocks clicks */}
        <div className="global-scanlines" aria-hidden="true" />

        <a
          href="#main-content"
          style={{ position: 'absolute', left: '-9999px' }}
          className="focus:not-sr-only focus:left-2 focus:top-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded"
        >
          Skip to main content
        </a>

        <Navbar />

        <main
          id="main-content"
          style={{ flex: 1, minWidth: 0, overflowX: 'hidden', position: 'relative', zIndex: 1 }}
        >
          <BattleTransition>{children}</BattleTransition>
        </main>

        <MobileNav />
      </body>
    </html>
  );
}
