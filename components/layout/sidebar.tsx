'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, PhoneIncoming, Phone, Settings, LogOut, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLang } from '@/contexts/lang';
import LangSwitcher from './lang-switcher';
import ThemeToggle from '@/components/theme-toggle';

interface SidebarProps {
  isAdmin?: boolean;
  impersonatingUsername?: string;
}

export default function Sidebar({ isAdmin, impersonatingUsername }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { T } = useLang();

  const nav = [
    { label: T.outbound.toUpperCase(), accent: 'green', items: [
      { href: '/',         label: T.outbound, icon: Home,          active: (p: string) => p === '/' || p.startsWith('/campaigns') },
    ]},
    { label: T.inbound.toUpperCase(), accent: 'purple', items: [
      { href: '/inbound',     label: T.inbound, icon: PhoneIncoming, active: (p: string) => p === '/inbound' || /^\/hotlines\/\d/.test(p) },
      { href: '/inbound/new', label: T.hotline, icon: Phone,         active: (p: string) => p === '/inbound/new' },
    ]},
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-card h-full">
      {impersonatingUsername && (
        <div className="bg-amber-500 text-amber-950 px-3 py-1.5 text-[11px] font-medium flex items-center justify-between">
          <span>As: <strong>{impersonatingUsername}</strong></span>
          <button
            className="underline hover:no-underline text-[11px]"
            onClick={async () => {
              await fetch('/api/admin/impersonate', { method: 'DELETE' });
              router.push('/admin');
            }}
          >Exit</button>
        </div>
      )}
      <div className="px-4 py-5 flex items-center gap-2">
        <Phone className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold tracking-tight">business-console</span>
      </div>
      <Separator />
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {nav.map((group) => (
          <div key={group.label}>
            <p className={cn(
              'px-2 mb-1 text-[10px] font-semibold tracking-widest',
              group.accent === 'purple' ? 'text-violet-400' : 'text-muted-foreground',
            )}>
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon, active: activeFn }) => {
              const active = activeFn(pathname);
              const isInbound = group.accent === 'purple';
              return (
                <Link
                  key={href + label}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    active && !isInbound && 'bg-primary/10 text-primary font-medium',
                    active && isInbound  && 'bg-violet-500/10 text-violet-400 font-medium',
                    !active && 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <Separator />
      <div className="px-2 py-3 space-y-1">
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-amber-500/10 text-amber-500 font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            Admin
          </Link>
        )}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {T.settings}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground px-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {T.signOut}
        </Button>
      </div>
      <Separator />
      <div className="px-3 py-3 flex items-center gap-2">
        <LangSwitcher />
        <ThemeToggle />
      </div>
    </aside>
  );
}
