import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Brain,
  ListChecks,
  Send,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  runOrchestration,
  listPlans,
} from "@/lib/hub-orchestrator.functions";

export const Route = createFileRoute("/_authenticated/orchestration")({
  component: OrchestrationPage,
});

type PlanRow = {
  id: string;
  prompt: string;
  status: string;
  user_intent: string | null;
  language: string | null;
  timings: Record<string, number> | null;
  created_at: string;
  final_response: any;
};

function statusColor(s: string) {
  if (s === "done") return "bg-green-500/15 text-green-600 border-green-500/30";
  if (s === "failed") return "bg-red-500/15 text-red-600 border-red-500/30";
  if (s === "partial") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
  return "bg-blue-500/15 text-blue-600 border-blue-500/30";
}

function OrchestrationPage() {
  const qc = useQueryClient();
  const runFn = useServerFn(runOrchestration);
  const listFn = useServerFn(listPlans);

  const [prompt, setPrompt] = useState(
    "Create a website for a restaurant with a logo, hero images, sections, and deployment.",
  );

  const { data: plans = [] } = useQuery({
    queryKey: ["hub-plans"],
    queryFn: () => listFn() as Promise<PlanRow[]>,
    refetchInterval: 4000,
  });

  const runMut = useMutation({
    mutationFn: (p: string) => runFn({ data: { prompt: p } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Plan complete: ${r.response?.status}`);
      else toast.error(r?.error ?? "Orchestration failed");
      qc.invalidateQueries({ queryKey: ["hub-plans"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Hub Orchestration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          HN Service Hub — 5 engines: <b>Request Analyzer</b> → <b>Task Planner</b> →{" "}
          <b>Task Dispatcher</b> → <b>Result Collector</b> → <b>Response Builder</b>.
        </p>
      </div>

      <Card className="p-5 space-y-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Prompt
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="font-mono text-sm"
          placeholder="e.g. Create a restaurant website with logo, images, texts, DB and deployment"
        />
        <div className="flex justify-end">
          <Button
            onClick={() => runMut.mutate(prompt.trim())}
            disabled={!prompt.trim() || runMut.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {runMut.isPending ? "Orchestrating…" : "Run orchestrator"}
          </Button>
        </div>

        {runMut.data && (runMut.data as any).ok && (
          <ResultView result={runMut.data as any} />
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <ListChecks className="h-4 w-4" /> Recent plans
        </h2>
        <div className="space-y-2">
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          )}
          {plans.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 border rounded-md px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{p.prompt}</div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center flex-wrap">
                  <Badge variant="outline">{p.user_intent ?? "—"}</Badge>
                  <span>{p.language ?? "?"}</span>
                  <span>·</span>
                  <span>{new Date(p.created_at).toLocaleString()}</span>
                  {p.timings && Object.keys(p.timings).length > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-mono">
                        {Object.entries(p.timings)
                          .map(([k, v]) => `${k}:${v}ms`)
                          .join(" ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <Badge className={statusColor(p.status)}>{p.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ResultView({ result }: { result: any }) {
  const plan = result?.plan;
  const response = result?.response;
  const tasks = plan?.tasks ?? [];
  const timings = result?.timings ?? {};

  return (
    <div className="mt-4 space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["analyze", "plan", "dispatch", "collect", "build"].map((s) => (
          <Badge key={s} variant="outline" className="font-mono">
            {s}: {timings[s] ?? 0}ms
          </Badge>
        ))}
        <Badge className={statusColor(response?.status ?? "done")}>
          {response?.status}
        </Badge>
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4" /> Plan graph
        </h3>
        <div className="grid gap-2">
          {tasks.map((t: any) => {
            const exec = response?.results?.[t.id];
            const ok = exec && !exec.error;
            return (
              <div key={t.id} className="border rounded-md p-3 flex items-start gap-3">
                <div>
                  {exec?.error ? (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  ) : exec ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.title}</span>
                    <Badge variant="outline" className="text-xs">{t.type}</Badge>
                    {exec?.site && (
                      <Badge variant="secondary" className="text-xs">
                        → {exec.site}
                      </Badge>
                    )}
                    {t.depends_on?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        depends: {t.depends_on.join(", ")}
                      </span>
                    )}
                    {exec?.ms != null && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {exec.ms}ms
                      </span>
                    )}
                  </div>
                  {exec?.error && (
                    <div className="text-xs text-red-600 mt-1">{exec.error}</div>
                  )}
                  {ok && exec?.output != null && (
                    <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto max-h-40">
                      {JSON.stringify(exec.output, null, 2).slice(0, 1500)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
