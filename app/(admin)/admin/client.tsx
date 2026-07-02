'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, LogIn, LogOut, Plus, Shield, User, ExternalLink, CheckCircle2, AlertCircle, XCircle, Settings2 } from 'lucide-react';

interface Account {
  id: number;
  username: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
  setup_health: 'ready' | 'partial' | 'not_configured';
  hotline_count: number;
  campaign_count: number;
  inbound_count: number;
  outbound_count: number;
}

interface Props {
  accounts: Account[];
  currentAccountId: number;
  impersonatingAccountId?: number;
  impersonatingUsername?: string;
}

function SetupBadge({ health }: { health: string }) {
  if (health === 'ready')
    return <span className="flex items-center gap-1 text-green-500 text-xs whitespace-nowrap"><CheckCircle2 className="h-3 w-3" />Ready</span>;
  if (health === 'partial')
    return <span className="flex items-center gap-1 text-amber-500 text-xs whitespace-nowrap"><AlertCircle className="h-3 w-3" />Partial</span>;
  return <span className="flex items-center gap-1 text-muted-foreground text-xs whitespace-nowrap"><XCircle className="h-3 w-3" />Not set</span>;
}

export default function AdminPageClient({ accounts: initial, currentAccountId, impersonatingAccountId, impersonatingUsername }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleImpersonate(accountId: number) {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    });
    if (res.ok) router.push('/');
  }

  async function handleStopImpersonating() {
    await fetch('/api/admin/impersonate', { method: 'DELETE' });
    router.refresh();
  }

  async function handleDelete(accountId: number, uname: string) {
    if (!confirm(`Delete account "${uname}"? This will delete all their data.`)) return;
    const res = await fetch(`/api/admin/accounts/${accountId}`, { method: 'DELETE' });
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to delete');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    const data = await res.json();
    if (res.ok) {
      setAccounts((prev) => [...prev, { ...data, is_admin: false, setup_health: 'not_configured', hotline_count: 0, campaign_count: 0, inbound_count: 0, outbound_count: 0 }]);
      setUsername(''); setPassword(''); setDisplayName('');
      setShowCreate(false);
    } else {
      setError(data.error ?? 'Failed to create account');
    }
    setCreating(false);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Impersonation banner */}
      {impersonatingAccountId && (
        <div className="bg-amber-500 text-amber-950 rounded-lg px-4 py-2 flex items-center justify-between text-sm font-medium">
          <span>Impersonating: <strong>{impersonatingUsername}</strong></span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleStopImpersonating}>
            <LogOut className="h-3 w-3 mr-1" /> Exit
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Admin — Accounts</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/providers">
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4 mr-1" /> Providers
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-1" /> New Account
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Logout
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Accounts table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium text-center">Hotlines</th>
                <th className="px-4 py-3 font-medium text-center">Campaigns</th>
                <th className="px-4 py-3 font-medium text-center">Inbound</th>
                <th className="px-4 py-3 font-medium text-center">Outbound</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {account.is_admin
                        ? <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      }
                      <span className="font-medium">{account.username}</span>
                      {account.display_name && (
                        <span className="text-muted-foreground text-xs">({account.display_name})</span>
                      )}
                      {account.id === currentAccountId && (
                        <Badge variant="secondary" className="text-[10px] h-4">you</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SetupBadge health={account.setup_health} />
                  </td>
                  <td className="px-4 py-3 text-center">{account.hotline_count}</td>
                  <td className="px-4 py-3 text-center">{account.campaign_count}</td>
                  <td className="px-4 py-3 text-center">{account.inbound_count}</td>
                  <td className="px-4 py-3 text-center">{account.outbound_count}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(account.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => router.push(`/admin/accounts/${account.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      {!account.is_admin && account.id !== currentAccountId && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleImpersonate(account.id)}
                          >
                            <LogIn className="h-3.5 w-3.5 mr-1" /> Impersonate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(account.id, account.username)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
