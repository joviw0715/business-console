'use client';

import { useState, useRef, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Upload, Image as ImageIcon, FileText, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CsvRow {
  [key: string]: string;
}

interface ExtractedContact {
  name: string;
  phone: string;
  custom_field: string;
}

export default function ImportContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: campaignId } = use(params);

  // Tab state
  const [tab, setTab] = useState<'csv' | 'image'>('csv');

  // ── CSV state ────────────────────────────────────────────────────────────────
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // ── Image state ───────────────────────────────────────────────────────────────
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgDragging, setImgDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContact[]>([]);
  const [imgImporting, setImgImporting] = useState(false);

  // Revoke stale object URL when the preview changes or the component unmounts
  useEffect(() => {
    return () => {
      if (imgPreview) URL.revokeObjectURL(imgPreview);
    };
  }, [imgPreview]);

  // ── CSV logic ─────────────────────────────────────────────────────────────────
  function parseCsv(text: string) {
    const lines = text.trim().split('\n');
    const hdrs = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    setHeaders(hdrs);
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

  function handleCsvFile(f: File) {
    setCsvFile(f);
    const reader = new FileReader();
    reader.onload = (e) => parseCsv(e.target?.result as string);
    reader.readAsText(f);
  }

  async function handleCsvImport() {
    if (!csvFile || !campaignId) return;
    setCsvImporting(true);
    setCsvError(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('mapping', JSON.stringify(mapping));
      const res = await fetch(`/api/campaigns/${campaignId}/contacts/import`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        router.push(`/campaigns/${campaignId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setCsvError(data.error ?? `Import failed (${res.status})`);
      }
    } catch (e) {
      setCsvError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCsvImporting(false);
    }
  }

  const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];

  // ── Image logic ───────────────────────────────────────────────────────────────
  function handleImageFile(f: File) {
    setImgFile(f);
    setExtracted([]);
    setExtractError(null);
    const url = URL.createObjectURL(f);
    setImgPreview(url);
  }

  async function handleExtract() {
    if (!imgFile) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const fd = new FormData();
      fd.append('image', imgFile);
      const res = await fetch(`/api/campaigns/${campaignId}/contacts/extract-image`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error ?? 'Extraction failed');
      } else {
        setExtracted(data.contacts ?? []);
        if ((data.contacts ?? []).length === 0) {
          setExtractError('No contacts found in image. Try a clearer photo.');
        }
      }
    } catch (e) {
      setExtractError(String(e));
    } finally {
      setExtracting(false);
    }
  }

  function updateExtracted(i: number, field: keyof ExtractedContact, value: string) {
    setExtracted((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  function removeExtracted(i: number) {
    setExtracted((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleImageImport() {
    if (!extracted.length || !campaignId) return;
    setImgImporting(true);
    setExtractError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: extracted }),
      });
      if (res.ok) {
        router.push(`/campaigns/${campaignId}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setExtractError(data.error ?? `Import failed (${res.status})`);
        setImgImporting(false);
      }
    } catch (e) {
      setExtractError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      setImgImporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-sm text-muted-foreground flex gap-2">
        <Link href="/" className="hover:text-foreground">Campaigns</Link>
        <span>/</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-foreground">Detail</Link>
        <span>/</span>
        <span className="text-foreground">Import Contacts</span>
      </div>
      <h1 className="text-2xl font-bold">Import Contacts</h1>

      {/* Tab switcher */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          onClick={() => setTab('csv')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm transition-colors',
            tab === 'csv' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <FileText className="h-4 w-4" />CSV
        </button>
        <button
          onClick={() => setTab('image')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm transition-colors border-l border-border',
            tab === 'image' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <ImageIcon className="h-4 w-4" />Image
        </button>
      </div>

      {/* ── CSV TAB ── */}
      {tab === 'csv' && (
        <>
          <Card
            className={`border-dashed transition-colors cursor-pointer ${csvDragging ? 'border-primary bg-accent/30' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
            onDragLeave={() => setCsvDragging(false)}
            onDrop={(e) => { e.preventDefault(); setCsvDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
            onClick={() => csvFileRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">{csvFile ? csvFile.name : 'Drag & drop CSV here'}</p>
                <p className="text-sm text-muted-foreground">{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'or click to browse'}</p>
              </div>
              <p className="text-xs text-muted-foreground">Required column: phone — Optional: name, any custom fields</p>
            </CardContent>
          </Card>
          <input ref={csvFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />

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

          {preview.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-sm">Preview <span className="font-normal text-muted-foreground">(first 3 rows)</span></h2>
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
            {csvError && (
              <p className="text-sm text-destructive self-center">{csvError}</p>
            )}
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleCsvImport} disabled={!csvFile || !phoneCol || csvImporting}>
              {csvImporting ? 'Importing…' : 'Import Contacts'}
            </Button>
          </div>
        </>
      )}

      {/* ── IMAGE TAB ── */}
      {tab === 'image' && (
        <>
          <Card
            className={`border-dashed transition-colors cursor-pointer ${imgDragging ? 'border-primary bg-accent/30' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setImgDragging(true); }}
            onDragLeave={() => setImgDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setImgDragging(false);
              const f = e.dataTransfer.files[0];
              if (f && f.type.startsWith('image/')) handleImageFile(f);
            }}
            onClick={() => imgFileRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
              {imgPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgPreview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Drag & drop a photo here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — AI will extract names, phone numbers, and times</p>
                </>
              )}
              {imgFile && (
                <p className="text-xs text-muted-foreground">{imgFile.name} · {(imgFile.size / 1024).toFixed(1)} KB</p>
              )}
            </CardContent>
          </Card>
          <input
            ref={imgFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
          />

          {imgFile && extracted.length === 0 && (
            <div className="flex justify-end">
              <Button onClick={handleExtract} disabled={extracting}>
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</> : 'Extract Contacts'}
              </Button>
            </div>
          )}

          {extractError && (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">{extractError}</p>
          )}

          {extracted.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">
                  Extracted contacts <span className="font-normal text-muted-foreground">({extracted.length}) — edit before importing</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={handleExtract} disabled={extracting} className="text-xs h-7">
                  {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Re-extract'}
                </Button>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-40">Name</TableHead>
                      <TableHead className="text-xs w-44">Phone</TableHead>
                      <TableHead className="text-xs">Note / Time</TableHead>
                      <TableHead className="text-xs w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extracted.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5">
                          <Input
                            value={row.name}
                            onChange={(e) => updateExtracted(i, 'name', e.target.value)}
                            className="h-7 text-sm"
                            placeholder="Name"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            value={row.phone}
                            onChange={(e) => updateExtracted(i, 'phone', e.target.value)}
                            className="h-7 text-sm"
                            placeholder="+852..."
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            value={row.custom_field}
                            onChange={(e) => updateExtracted(i, 'custom_field', e.target.value)}
                            className="h-7 text-sm"
                            placeholder="Optional"
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <button onClick={() => removeExtracted(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {extracted.some((r) => !r.phone.trim()) && (
                <p className="text-xs text-destructive">Some rows are missing a phone number.</p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button
              onClick={handleImageImport}
              disabled={extracted.length === 0 || extracted.some((r) => !r.phone.trim()) || imgImporting}
            >
              {imgImporting ? 'Importing…' : `Import ${extracted.length > 0 ? extracted.length : ''} Contact${extracted.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
