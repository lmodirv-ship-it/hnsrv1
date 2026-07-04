import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listFallbackRules, upsertFallbackRule, deleteFallbackRule, listServicesLite } from "@/lib/engine.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fallback-rules")({
  component: FallbackRulesPage,
});

function FallbackRulesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFallbackRules);
  const svcFn = useServerFn(listServicesLite);
  const upsertFn = useServerFn(upsertFallbackRule);
  const delFn = useServerFn(deleteFallbackRule);

  const { data: rules = [] } = useQuery({ queryKey: ["fallback-rules"], queryFn: () => listFn() });
  const { data: services = [] } = useQuery({ queryKey: ["services-lite"], queryFn: () => svcFn() });

  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [primaryId, setPrimaryId] = useState("");
  const [fallbackId, setFallbackId] = useState("");
  const [priority, setPriority] = useState(100);
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      intent_pattern: pattern,
      primary_service_id: primaryId || null,
      fallback_service_id: fallbackId,
      priority, enabled: true, notes: notes || null,
    } }),
    onSuccess: () => {
      setOpen(false); setPattern(""); setPrimaryId(""); setFallbackId(""); setPriority(100); setNotes("");
      qc.invalidateQueries({ queryKey: ["fallback-rules"] });
      toast.success("تم حفظ القاعدة");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fallback-rules"] }),
  });
  const toggle = useMutation({
    mutationFn: (r: any) => upsertFn({ data: {
      id: r.id, intent_pattern: r.intent_pattern, primary_service_id: r.primary_service_id,
      fallback_service_id: r.fallback_service_id, priority: r.priority, enabled: !r.enabled, notes: r.notes,
    } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fallback-rules"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">قواعد البدائل (Fallback)</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />قاعدة جديدة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>قاعدة بديل جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>نمط النيّة (Regex)</Label>
                <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="مثال: generate.*video|subtitle" />
              </div>
              <div>
                <Label>الخدمة الأساسية (اختياري)</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
                  <option value="">أي خدمة</option>
                  {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.sites?.slug}</option>)}
                </select>
              </div>
              <div>
                <Label>الخدمة البديلة</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={fallbackId} onChange={(e) => setFallbackId(e.target.value)}>
                  <option value="">— اختر —</option>
                  {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.sites?.slug}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الأولوية</Label>
                  <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <Button className="w-full" onClick={() => save.mutate()} disabled={!pattern || !fallbackId || save.isPending}>
                حفظ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rules.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          لا توجد قواعد. أضف قاعدة لتحديد ماذا يفعل الهَب إذا تعطلت خدمة معينة.
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r: any) => (
            <Card key={r.id} className="p-3 bg-card/60 backdrop-blur border-border/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  <code className="text-[11px] bg-background/60 rounded px-2 py-0.5">{r.intent_pattern}</code>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="text-xs">{r.fallback?.name ?? "—"}</span>
                  {r.primary?.name && <span className="text-[10px] text-muted-foreground">(بديل لـ {r.primary.name})</span>}
                </div>
                {r.notes && <div className="text-[11px] text-muted-foreground mt-1">{r.notes}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground">أولوية {r.priority}</span>
                <Switch checked={r.enabled} onCheckedChange={() => toggle.mutate(r)} />
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
