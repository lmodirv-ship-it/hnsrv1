import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Cpu, Zap, Loader2, Play, Wand2, CheckCircle2, XCircle, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  listAgents,
  generateAgents,
  setAgentActive,
  activateAllAgents,
  runAgent,
  type HnAgent,
} from "@/lib/agents.functions";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAgents);
  const gen = useServerFn(generateAgents);
  const setActive = useServerFn(setAgentActive);
  const activateAll = useServerFn(activateAllAgents);
  const run = useServerFn(runAgent);

  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<HnAgent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hn_agents"],
    queryFn: () => list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hn_agents"] });

  const genMut = useMutation({
    mutationFn: () => gen(),
    onSuccess: (r: any) => {
      toast.success(`تم توليد/تحديث ${r?.generated ?? 0} وكيل`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التوليد"),
  });

  const activateMut = useMutation({
    mutationFn: () => activateAll(),
    onSuccess: (r: any) => {
      toast.success(`تم تفعيل ${r?.activated ?? 0} وكيل`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التفعيل"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setActive({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "فشل التبديل"),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`نُفّذ الوكيل (${r?.latency_ms ?? 0}ms)`);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التنفيذ"),
  });

  const agents = (data ?? []) as HnAgent[];
  const filtered = agents.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.site_name ?? "").toLowerCase().includes(q) ||
      (a.service_name ?? "").toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    );
  });

  const activeCount = agents.filter((a) => a.is_active).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6" /> وكلاء HN (hn_agent)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            كل موقع × خدمة = وكيل Python يعمل في <code>d:\hn</code> أو <code>c:\hn</code>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => genMut.mutate()} disabled={genMut.isPending} variant="default">
            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            توليد الوكلاء
          </Button>
          <Button onClick={() => activateMut.mutate()} disabled={activateMut.isPending} variant="secondary">
            {activateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            تفعيل الكل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي الوكلاء</div><div className="text-2xl font-bold">{agents.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">مفعّلون</div><div className="text-2xl font-bold text-green-600">{activeCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">متوقفون</div><div className="text-2xl font-bold text-orange-600">{agents.length - activeCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">إجمالي التنفيذات</div><div className="text-2xl font-bold">{agents.reduce((s, a) => s + (a.runs_count ?? 0), 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>سجل الوكلاء</span>
            <Input
              placeholder="بحث بالاسم / الموقع / الدور..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              لا يوجد وكلاء بعد — اضغط "توليد الوكلاء" لإنشائهم من الخدمات النشطة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start p-2">#</th>
                    <th className="text-start p-2">الاسم</th>
                    <th className="text-start p-2">الموقع</th>
                    <th className="text-start p-2">الدور</th>
                    <th className="text-start p-2">اللغة</th>
                    <th className="text-start p-2">تنفيذات</th>
                    <th className="text-start p-2">مفعّل</th>
                    <th className="text-start p-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((a) => (
                    <tr key={a.id} className="border-b hover:bg-muted/40">
                      <td className="p-2 font-mono text-xs">{a.agent_number}</td>
                      <td className="p-2">{a.name}</td>
                      <td className="p-2 text-xs text-muted-foreground">{a.site_name}</td>
                      <td className="p-2"><Badge variant="outline">{a.role}</Badge></td>
                      <td className="p-2 text-xs">{a.script_lang}</td>
                      <td className="p-2 text-xs">
                        {a.last_run_status === "succeeded" ? <CheckCircle2 className="h-3 w-3 inline text-green-600" /> :
                         a.last_run_status === "failed" ? <XCircle className="h-3 w-3 inline text-red-600" /> : null}
                        {" "}{a.runs_count}
                      </td>
                      <td className="p-2">
                        <Switch
                          checked={a.is_active}
                          onCheckedChange={(v) => toggleMut.mutate({ id: a.id, active: v })}
                        />
                      </td>
                      <td className="p-2 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(a)}>
                          <Code2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => runMut.mutate(a.id)} disabled={runMut.isPending}>
                          <Play className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  عرض 500 من {filtered.length} — استخدم البحث للتصفية
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">الموقع:</span> {viewing.site_name}</div>
                <div><span className="text-muted-foreground">الخدمة:</span> {viewing.service_name}</div>
                <div><span className="text-muted-foreground">الدور:</span> {viewing.role}</div>
                <div><span className="text-muted-foreground">المسار:</span> <code>{viewing.runtime_path}</code></div>
                <div><span className="text-muted-foreground">الأدوات:</span> {viewing.tools.join(", ")}</div>
                <div><span className="text-muted-foreground">اللغة:</span> {viewing.script_lang}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">السكربت:</div>
                <Textarea value={viewing.script_content ?? ""} readOnly rows={18} className="font-mono text-xs" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
