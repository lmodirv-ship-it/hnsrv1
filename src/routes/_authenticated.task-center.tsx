import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listTaskCenterTasks, submitTask } from "@/lib/group-exchange.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, ListChecks } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/task-center")({
  component: TaskCenterPage,
});

const statusColor: Record<string, string> = {
  received: "bg-amber-500/15 text-amber-400",
  routed: "bg-sky-500/15 text-sky-400",
  dispatched: "bg-sky-500/15 text-sky-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  returned: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
};

function TaskCenterPage() {
  const list = useServerFn(listTaskCenterTasks);
  const submit = useServerFn(submitTask);
  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["task-center"],
    queryFn: () => list(),
  });

  const [site, setSite] = useState("");
  const [intent, setIntent] = useState("");

  const mut = useMutation({
    mutationFn: () => submit({ data: { requester_site: site, service_intent: intent } }),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`تم التنفيذ عبر ${r.provider?.site ?? "المزود"}`);
      else toast.error(r.error ?? "تعذّر تنفيذ المهمة");
      setIntent("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "خطأ غير متوقع"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">مركز المهام</h1>
          <p className="text-xs text-muted-foreground">
            كل طلب خدمة يصل من مواقع المجموعة يُوجَّه هنا إلى الموقع المسؤول، ثم تعود النتيجة عبر
            TVCC إلى الموقع الطالب.
          </p>
        </div>
      </div>

      <Card className="p-5 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="الموقع الطالب (مثال: cinema.hn-groupe.org)"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
          <Input
            placeholder="الخدمة المطلوبة (مثال: توليد صورة)"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !site || !intent}>
            {mut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 me-1" />
            )}
            إرسال المهمة
          </Button>
        </div>
        <div className="text-xs text-muted-foreground border-t border-border/40 pt-2 font-mono">
          POST /api/public/v1/task-center
        </div>
      </Card>

      {!tasks.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد مهام بعد</Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t: any) => (
            <Card key={t.id} className="p-3 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {t.requester_site} → {t.provider_site ?? "—"} · {t.service_intent}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                    {t.latency_ms != null ? ` • ${t.latency_ms}ms` : ""}
                    {t.error ? ` • ${t.error}` : ""}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${statusColor[t.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {t.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
