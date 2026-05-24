'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload } from 'lucide-react';
import Link from 'next/link';

interface CsvRow {
  [key: string]: string;
}

export default function ImportContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [campaignId, setCampaignId] = useState<string>('');

  // Resolve params on mount
  useState(() => {
    params.then((p) => setCampaignId(p.id));
  });

  function parseCsv(text: string) {
    const lines = text.trim().split('\n');
    const hdrs = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    setHeaders(hdrs);

    // Auto-detect mapping
    const auto: Record<string, string> = {};
    hdrs.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel') || lower.includes('number')) {
        auto[h] = 'phone';
      } else if (lower.includes('name')) {
        auto[h] = 'name';
      }
    });
    setMapping(auto);

    const rows = lines.slice(1, 4).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(hdrs.map((h, i) => [h, vals[i] ?? '']));
    });
    setPreview(rows);
  }

  function handleFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => parseCsv(e.target?.result as string);
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file || !campaignId) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    const res = await fetch(`/api/campaigns/${campaignId}/contacts/import`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      router.push(`/campaigns/${campaignId}`);
    } else {
      setImporting(false);
    }
  }

  const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];
  const previewCount = file ? '(preview: first 3 rows)' : '';

  return (
    <div className="max-w-2xl space-y-6">
      <div className="text-sm text-muted-foreground flex gap-2">
        <Link href="/campaigns" className="hover:text-foreground">Campaigns</Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground">Detail</Link>
        <span>/</span>
        <span className="text-foreground">Import Contacts</span>
      </div>
      <h1 className="text-2xl font-bold">Import Contacts</h1>

      {/* Drop zone */}
      <Card
        className={`border-dashed transition-colors cursor-pointer ${dragging ? 'border-primary bg-accent/30' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">{file ? file.name : 'Drag & drop CSV here'}</p>
            <p className="text-sm text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse'}</p>
          </div>
          <p className="text-xs text-muted-foreground">Required column: phone — Optional: name, any custom fields</p>
        </CardContent>
      </Card>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {/* Column mapping */}
      {headers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Column Mapping</h2>
          <div className="rounded-lg border divide-y">
            {headers.map((h) => (
              <div key={h} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-sm">{h}</span>
                <Select value={mapping[h] ?? 'skip'} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v ?? 'skip' }))}>
                  <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">phone *</SelectItem>
                    <SelectItem value="name">name</SelectItem>
                    <SelectItem value="custom">custom field</SelectItem>
                    <SelectItem value="skip">skip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {!phoneCol && (
            <p className="text-sm text-destructive">Map at least one column to &quot;phone&quot; to continue.</p>
          )}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm">Preview {previewCount}</h2>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i}>
                    {headers.map((h) => <TableCell key={h} className="text-sm">{row[h]}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleImport} disabled={!file || !phoneCol || importing}>
          {importing ? 'Importing…' : 'Import Contacts'}
        </Button>
      </div>
    </div>
  );
}
