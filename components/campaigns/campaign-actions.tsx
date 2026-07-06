'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Play, Pause, Trash2, RotateCcw, Copy, BookmarkPlus } from 'lucide-react';
import type { Campaign } from '@/types';
import { useLang } from '@/contexts/lang';

export default function CampaignActions({ campaign, onAction }: { campaign: Campaign; onAction?: () => void }) {
  const router = useRouter();
  const { T } = useLang();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'pause' | 'resume' | 'delete' | 'reset' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function performAction(action: string) {
    setShowConfirm(false);
    setErrorMsg(null);

    if (action === 'save_template') {
      const name = prompt('Template name:');
      if (!name?.trim()) return;
      await fetch('/api/user-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          emoji: '⭐',
          campaign_name: campaign.name,
          greeting_text: campaign.greeting_text ?? null,
          system_prompt: campaign.system_prompt ?? null,
        }),
      });
      return;
    }

    if (action === 'duplicate') {
      const res = await fetch(`/api/campaigns/${campaign.id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const { id } = await res.json();
        router.push(`/campaigns/${id}/contacts/import`);
      }
      return;
    }

    if (action === 'delete') {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/campaigns');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? 'Failed to delete campaign.');
        setPendingAction('delete');
        setShowConfirm(true);
      }
      return;
    }

    await fetch(`/api/campaigns/${campaign.id}/${action}`, { method: 'POST' });
    // Call parent reload callback if provided, otherwise fall back to router.refresh()
    if (onAction) {
      onAction();
    } else {
      router.refresh();
    }
  }

  function confirm(action: 'start' | 'pause' | 'resume' | 'delete' | 'reset') {
    setErrorMsg(null);
    setPendingAction(action);
    setShowConfirm(true);
  }

  const isDeleteBlocked = !!errorMsg && pendingAction === 'delete';

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {campaign.status === 'running' && (
          <Button variant="outline" size="sm" onClick={() => confirm('pause')}>
            <Pause className="h-4 w-4 mr-1" />{T.pauseCampaign}
          </Button>
        )}
        {(campaign.status === 'paused' || campaign.status === 'draft') && (
          <Button size="sm" onClick={() => confirm(campaign.status === 'draft' ? 'start' : 'resume')}>
            <Play className="h-4 w-4 mr-1" />
            {campaign.status === 'draft' ? T.startCampaign : T.resumeCampaign}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9")}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/contacts/import`)}>
              {T.importContacts}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/reports`)}>
              {T.viewReports}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => performAction('duplicate')}>
              <Copy className="h-4 w-4 mr-2" />{T.duplicateCampaign}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => performAction('save_template')}>
              <BookmarkPlus className="h-4 w-4 mr-2" />{T.saveAsTemplate}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => confirm('reset')}>
              <RotateCcw className="h-4 w-4 mr-2" />{T.resetRetry}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => window.location.assign(`/api/campaigns/${campaign.id}/export`)}
            >
              {T.exportCSV}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => confirm('delete')}>
              <Trash2 className="h-4 w-4 mr-2" />{T.deleteCampaign}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === 'start'  && `${T.startCampaign}?`}
              {pendingAction === 'resume' && `${T.resumeCampaign}?`}
              {pendingAction === 'pause'  && `${T.pauseCampaign}?`}
              {pendingAction === 'reset'  && `${T.resetRetry}?`}
              {pendingAction === 'delete' && `${T.deleteCampaign}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === 'start'  && (T.tabContacts === '聯絡人' ? '將開始致電所有待處理聯絡人。' : 'This will begin dialling all pending contacts.')}
              {pendingAction === 'resume' && (T.tabContacts === '聯絡人' ? '將繼續致電剩餘聯絡人。' : 'This will resume dialling remaining contacts.')}
              {pendingAction === 'pause'  && (T.tabContacts === '聯絡人' ? '進行中的通話將完成，但不會開始新通話。' : 'Active calls will finish but no new calls will start.')}
              {pendingAction === 'reset'  && (T.tabContacts === '聯絡人' ? '所有聯絡人將重設為待處理狀態，活動退回草稿。通話記錄及報告保留不變。' : 'All contacts will be reset to pending and the campaign set back to draft. Call history and reports are kept.')}
              {pendingAction === 'delete' && !isDeleteBlocked && (
                T.tabContacts === '聯絡人'
                  ? `此操作將永久刪除「${campaign.name}」及其所有聯絡人、通話記錄及報告，無法復原。`
                  : `This will permanently delete "${campaign.name}" and all its contacts, call records, and reports. This cannot be undone.`
              )}
              {isDeleteBlocked && <span className="text-destructive">{errorMsg}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T.cancel}</AlertDialogCancel>
            {!isDeleteBlocked && (
              <AlertDialogAction
                className={pendingAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                onClick={() => pendingAction && performAction(pendingAction)}
              >
                {pendingAction === 'delete' ? T.deleteCampaign : T.saving ?? 'Confirm'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
