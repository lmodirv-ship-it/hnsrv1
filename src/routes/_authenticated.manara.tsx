import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { ManaraSphere } from "@/components/manara/manara-sphere";
import {
  listManaraExports,
  listManaraImports,
  listManaraNodes,
  publishManaraSignal,
  setImportStatus,
} from "@/lib/manara.functions";

export const Route = createFileRoute("/_authenticated/manara")({
  component: ManaraPage,
  head: () => ({
    meta: [
      { title: "منارة — شبكة تبادل المعرفة بين مواقع HN" },
      {
        name: "description",
        content:
          "منارة: نقطة الاتصال الموحّدة بين مواقع وتطبيقات مجموعة HN لتبادل تغييرات النطاقات والمسارات.",
      },
      { property: "og:title", content: "منارة — شبكة مجموعة HN" },
      {
        property: "og:description",
        content: "تبادل الشيفرات وتغييرات النطاقات بين مواقع مجموعة HN من مكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ManaraPage() {
  const exportsFn = useServerFn(listManaraExports);
  const importsFn = useServerFn(listManaraImports);
  const nodesFn = useServerFn(listManaraNodes);
  const publish = useServerFn(publishManaraSignal);
  const setStatus = useServerFn(setImportStatus);

  const { data: nodes = [] } = useQuery({ queryKey: ["manara-nodes"], queryFn: () => nodesFn() });
  const { data: exps = [], refetch: refetchExp } = useQuery({
    queryKey: ["manara-exports"],
    queryFn: () => exportsFn(),
  });
  const { data: imps = [], refetch: refetchImp } = useQuery({
    queryKey: ["manara-imports"],
    queryFn: () => importsFn(),
  });

  const [sourceSite, setSourceSite] = useState("");
  const [signalKey, setSignalKey] = useState("base_url");
  const [oldValue, setOldValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [targets, setTargets] = useState("");

  const publishMut = useMutation({
    mutationFn: () =>
      publish({
        data: {
          source_site: sourceSite,
          signal_type: "domain_change",
          signal_key: signalKey,
          old_value: oldValue || null,
          new_value: newValue || null,
          targets: targets
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("تم إرسال الشيفرة إلى شبكة منارة");
      refetchExp();
      refetchImp();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإرسال"),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, process_status: "applied" } }),
    onSuccess: () => {
      toast.success("تم تطبيق الشيفرة");
      refetchImp();
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">منارة / MANARA</h1>
          <p className="text-sm text-muted-foreground">
            شبكة تبادل المعرفة بين مواقع وتطبيقات مجموعة HN
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60 bg-card/40 p-6 backdrop-blur">
        <ManaraSphere nodes={nodes as any} />
        <div className="mt-4 text-center text-xs text-muted-foreground">
          {nodes.length} موقعًا في المدار · {exps.length} تصدير · {imps.length} استيراد
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-5 backdrop-blur">
        <h2 className="mb-4 font-semibold">إعلان تغيير نطاق</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="m-src">الموقع المصدر</Label>
            <Input id="m-src" dir="ltr" value={sourceSite} onChange={(e) => setSourceSite(e.target.value)} placeholder="cour.hnapps.store" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-key">المفتاح</Label>
            <Input id="m-key" dir="ltr" value={signalKey} onChange={(e) => setSignalKey(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-old">القيمة القديمة</Label>
            <Input id="m-old" dir="ltr" value={oldValue} onChange={(e) => setOldValue(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-new">القيمة الجديدة</Label>
            <Input id="m-new" dir="ltr" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="m-targets">المواقع المستهدفة (مفصولة بفاصلة)</Label>
            <Input id="m-targets" dir="ltr" value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="tvcc, hn-db, hn-cloud" />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={publishMut.isPending || !sourceSite || !signalKey}
          onClick={() => publishMut.mutate()}
        >
          {publishMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الشيفرة"}
        </Button>
      </Card>

      <Tabs defaultValue="imports">
        <TabsList>
          <TabsTrigger value="imports">
            <ArrowDownToLine className="me-1.5 h-4 w-4" /> الاستيراد
          </TabsTrigger>
          <TabsTrigger value="exports">
            <ArrowUpFromLine className="me-1.5 h-4 w-4" /> التصدير
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imports" className="space-y-2">
          {imps.length === 0 && <p className="text-sm text-muted-foreground">لا توجد شيفرات واردة.</p>}
          {imps.map((r: any) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 border-border/60 bg-card/60 p-3">
              <Badge variant="outline">{r.signal_type}</Badge>
              <span className="font-mono text-xs">{r.sender_site} → {r.target_site}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.signal_key}: {r.value ?? "—"}</span>
              <Badge variant={r.process_status === "applied" ? "default" : "secondary"}>{r.process_status}</Badge>
              <div className="flex-1" />
              {r.process_status !== "applied" && (
                <Button size="sm" variant="outline" onClick={() => ackMut.mutate(r.id)}>
                  تطبيق
                </Button>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="exports" className="space-y-2">
          {exps.length === 0 && <p className="text-sm text-muted-foreground">لا توجد شيفرات صادرة.</p>}
          {exps.map((r: any) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 border-border/60 bg-card/60 p-3">
              <Badge variant="outline">{r.signal_type}</Badge>
              <span className="font-mono text-xs">{r.source_site}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {r.signal_key}: {r.old_value ?? "—"} → {r.new_value ?? "—"}
              </span>
              <Badge variant={r.status === "delivered" ? "default" : "secondary"}>{r.status}</Badge>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
