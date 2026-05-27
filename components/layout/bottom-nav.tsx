'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Megaphone, PhoneIncoming, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, accent: 'green' },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, accent: 'green' },
  { href: '/hotlines', label: 'Hotlines', icon: PhoneIncoming, accent: 'purple' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card flex items-stretch h-16">
      {tabs.slice(0, 2).map(({ href, label, icon: Icon, accent }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
              active && accent === 'green' && 'text-primary',
              active && accent === 'purple' && 'text-violet-400',
              !active && 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}

      {/* Center FAB */}
      <div className="flex-none flex items-center justify-center px-4">
        <Link
          href="/campaigns/new"
          className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg"
        >
          <Plus className="h-6 w-6 text-primary-foreground" />
        </Link>
      </div>

      {tabs.slice(2).map(({ href, label, icon: Icon, accent }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors',
              active && accent === 'purple' && 'text-violet-400',
              !active && 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}

      {/* Spacer to balance the FAB */}
      <div className="flex-1" />
    </nav>
  );
}
