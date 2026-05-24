'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Play, Pause, StopCircle } from 'lucide-react';
import type { Campaign } from '@/types';

export default function CampaignActions({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'pause' | 'resume' | null>(null);

  async function performAction(action: string) {
    await fetch(`/api/campaigns/${campaign.id}/${action}`, { method: 'POST' });
    router.refresh();
  }

  function confirm(action: 'start' | 'pause' | 'resume') {
    setPendingAction(action);
    setShowConfirm(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {campaign.status === 'running' && (
          <Button variant="outline" size="sm" onClick={() => confirm('pause')}>
            <Pause className="h-4 w-4 mr-1" />Pause
          </Button>
        )}
        {(campaign.status === 'paused' || campaign.status === 'draft') && (
          <Button size="sm" onClick={() => confirm(campaign.status === 'draft' ? 'start' : 'resume')}>
            <Play className="h-4 w-4 mr-1" />
            {campaign.status === 'draft' ? 'Start' : 'Resume'}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9")}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/contacts/import`)}>
              Import Contacts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/campaigns/${campaign.id}/reports`)}>
              View Reports
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => window.location.assign(`/api/campaigns/${campaign.id}/export`)}
            >
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === 'start' && 'Start campaign?'}
              {pendingAction === 'resume' && 'Resume campaign?'}
              {pendingAction === 'pause' && 'Pause campaign?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === 'start' && 'This will begin dialling all pending contacts.'}
              {pendingAction === 'resume' && 'This will resume dialling remaining contacts.'}
              {pendingAction === 'pause' && 'Active calls will finish but no new calls will start.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction && performAction(pendingAction)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
