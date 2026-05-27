'use client';

import { useLang } from '@/contexts/lang';
import { LANGUAGES } from '@/lib/translations';
import { cn } from '@/lib/utils';

export default function LangSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={cn(
            'px-2.5 py-1 text-xs transition-colors border-r border-border last:border-r-0',
            lang === l.code
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
