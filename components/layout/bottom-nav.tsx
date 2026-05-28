'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PhoneIncoming, Plus, Phone, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';

export default function BottomNav() {
  const pathname = usePathname();
  const { T } = useLang();

  const tabs = [
    { href: '/',            label: T.outbound, icon: Home,          accent: 'green'  },
    { href: '/inbound',     label: T.inbound,  icon: PhoneIncoming, accent: 'purple' },
    null,
    { href: '/inbound/new', label: T.hotline,  icon: Phone,         accent: 'purple', matchFn: (p: string) => p.startsWith('/hotlines/') },
    { href: '/settings',    label: T.settings, icon: Settings,      accent: 'green'  },
  ];

  function isActive(tab: typeof tabs[0]) {
    if (!tab) return false;
    if ('matchFn' in tab && tab.matchFn) return tab.matchFn(pathname);
    return tab!.href === '/' ? pathname === '/' : pathname.startsWith(tab!.href!);
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card flex items-stretch h-16">
      {tabs.map((tab, i) => {
        if (!tab) {
          return (
            <div key="fab" className="flex-none flex items-center justify-center px-3">
              <Link
                href="/campaigns/new"
                className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg"
              >
                <Plus className="h-6 w-6 text-primary-foreground" />
              </Link>
            </div>
          );
        }

        const active = isActive(tab);
        const { href, label, icon: Icon, accent } = tab;

        return (
          <Link
            key={i}
            href={href!}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
              active && accent === 'green'  && 'text-primary',
              active && accent === 'purple' && 'text-violet-400',
              !active && 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
