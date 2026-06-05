'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  reportId: number;
  campaignId: number;
  waSent: boolean;
  defaultPhone: string;
  defaultName: string;
  defaultDate: string;
  defaultTime: string;
  defaultPeople: string;
  defaultRestaurant: string;
}

export function WaSendButton({
  reportId, campaignId, waSent: initialWaSent,
  defaultPhone, defaultName, defaultDate, defaultTime, defaultPeople, defaultRestaurant,
}: Props) {
  const [waSent, setWaSent] = useState(initialWaSent);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [phone, setPhone]           = useState(defaultPhone);
  const [name, setName]             = useState(defaultName);
  const [date, setDate]             = useState(defaultDate);
  const [time, setTime]             = useState(defaultTime);
  const [people, setPeople]         = useState(defaultPeople);
  const [restaurant, setRestaurant] = useState(defaultRestaurant);

  const dateErr  = open && !date.trim();
  const timeErr  = open && !time.trim();
  const canSend  = date.trim() && time.trim() && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/${reportId}/send-wa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, restaurant, date, time, people }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '發送失敗'); return; }
      setWaSent(true);
      setOpen(false);
      setToast('✅ WhatsApp 確認已發送');
      setTimeout(() => setToast(''), 3000);
    } catch {
      setError('網絡錯誤，請重試');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {waSent ? (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            ✅ WhatsApp 確認已發送
          </Badge>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            重新發送
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          📤 發送 WhatsApp 確認
        </button>
      )}

      {toast && (
        <span className="text-xs text-green-400">{toast}</span>
      )}

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-sm">發送 WhatsApp 確認</h2>

            <div className="space-y-3">
              <Field label="收件人電話" value={phone} onChange={setPhone} />
              <Field label="客人姓名" value={name} onChange={setName} />
              <Field label="餐廳名稱" value={restaurant} onChange={setRestaurant} />
              <Field
                label="日期 *"
                value={date}
                onChange={setDate}
                placeholder="YYYY-MM-DD"
                error={dateErr ? '請填寫日期' : ''}
              />
              <Field
                label="時間 *"
                value={time}
                onChange={setTime}
                placeholder="HH:MM"
                error={timeErr ? '請填寫時間' : ''}
              />
              <Field label="人數" value={people} onChange={setPeople} placeholder="例：4" />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="sm"
                className="flex-1"
              >
                {sending ? '發送中…' : '確認發送'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label, value, onChange, placeholder = '', error = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-8 text-sm mt-0.5', error && 'border-destructive focus-visible:ring-destructive')}
      />
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}
