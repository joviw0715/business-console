'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Plus, PhoneIncoming, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/contexts/lang';

interface Hotline {
  id: number; name: string; twilio_number: string;
  status: string; live_count: number;
}

export default function InboundPage() {
  const { T } = useLang();
  const [hotlines, setHotlines] = useState<Hotline[]>([]);

  useEffect(() => {
    fetch('/api/hotlines').then((r) => r.json()).then(setHotlines).catch(() => {});
  }, []);

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.preventDefault();
    if (!confirm(T.confirmDeleteHotline)) return;
    const res = await fetch(`/api/hotlines/${id}`, { method: 'DELETE' });
    if (res.ok) setHotlines((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{T.inboundHotlines}</h1>
          <p className="text-sm text-muted-foreground mt-1">{T.inboundSubtitle}</p>
        </div>
        <Link href="/inbound/new" className={buttonVariants({ size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1.5" />{T.newHotline}
        </Link>
      </div>

      {hotlines.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          {T.noHotlinesYet}{' '}
          <Link href="/inbound/new" className="underline">{T.createOne}</Link>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hotlines.map((h) => (
            <div key={h.id} className="relative group">
              <Link
                href={`/hotlines/${h.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-violet-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="h-4 w-4 text-violet-400 shrink-0" />
                    <p className="font-medium text-sm">{h.name}</p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    h.status === 'active'
                      ? 'bg-violet-500/10 text-violet-400'
                      : 'bg-secondary text-muted-foreground',
                  )}>
                    {h.status === 'active' ? T.active : T.paused}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">{h.twilio_number}</p>
                {h.live_count > 0 ? (
                  <p className="text-xs text-green-400 ml-6 mt-1">{T.liveCalls(h.live_count)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground ml-6 mt-1">{T.idle}</p>
                )}
              </Link>
              <button
                onClick={(e) => handleDelete(e, h.id)}
                className="absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title={T.deleteHotline}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
