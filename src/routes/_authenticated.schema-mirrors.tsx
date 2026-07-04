import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Database, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { listSchemaMirrors, syncSchemaMirror } from "@/lib/schema-mirror.functions";

export const Route = createFileRoute("/_authenticated/schema-mirrors")({
  component: SchemaMirrorsPage,
});

function statusBadge(status: string) {
  if (status === "success")
    return <Badge className="bg-green-500/15 text-green-500 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />success</Badge>;
  if (status === "failed")
    return <Badge className="bg-red-500/15 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />failed</Badge>;
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />pending</Badge>;
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function SchemaMirrorsPage() {
  const list = useServerFn(listSchemaMirrors);
  const sync = useServerFn(syncSchemaMirror);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["schema-mirrors"],
    queryFn: () => list(),
  });

  const syncMut = useMutation({
    mutationFn: (target_name: string) => sync({ data: { target_name } }),
    onSuccess: (res) => {
      if (res.status === "success") toast.success(`Mirror synced (${res.tables} tables)`);
      else toast.error(`Sync failed: ${res.lastError ?? "unknown"}`);
      qc.invalidateQueries({ queryKey: ["schema-mirrors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Database className="h-6 w-6" /> External Schema Mirrors
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            HN Service Hub يرسل تعريفات الجداول إلى الأنظمة الخارجية كنسخة مرآة (بدون تنفيذ DDL).
          </p>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">Mirror targets</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tables</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Last attempt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {data?.mirrors.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">{m.target_name}</div>
                  <a href={m.target_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
                    {m.target_url} <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
                <TableCell>{m.source_name}</TableCell>
                <TableCell>{m.tables_count}</TableCell>
                <TableCell className="text-sm">{fmt(m.last_sync_at)}</TableCell>
                <TableCell className="text-sm">{fmt(m.last_attempt_at)}</TableCell>
                <TableCell>
                  {statusBadge(m.status)}
                  {m.last_error && (
                    <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={m.last_error}>
                      {m.last_error}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={() => syncMut.mutate(m.target_name)}
                    disabled={syncMut.isPending}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
                    Sync now
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">Tables being mirrored</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data?.tables.map((t) => (
            <div key={t.name} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm">{t.name}</div>
                <Badge variant="secondary">{t.columns_count} cols</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-muted/30">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>• المصدر الوحيد للحقيقة: HN Service Hub (Lovable Cloud).</div>
          <div>• الهدف يستقبل التعريفات فقط عبر <code>POST /api/external-schemas/mirror</code> مع توقيع <code>x-signature: sha256=…</code>.</div>
          <div>• لا يُنفَّذ أي DDL تلقائيًا على الهدف. لاحقًا يمكن إضافة endpoint إداري آمن لتنفيذ DDL حقيقي.</div>
        </div>
      </Card>
    </div>
  );
}
