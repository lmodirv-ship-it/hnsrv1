import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cpu, Zap, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  listHubEngines,
  setHubEngineEnabled,
  activateAllHubEngines,
  type HubEngine,
} from "@/lib/engines.functions";

export function EnginesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listHubEngines);
  const toggleFn = useServerFn(setHubEngineEnabled);
  const activateAllFn = useServerFn(activateAllHubEngines);

  const { data: engines = [], isLoading } = useQuery({
    queryKey: ["hub-engines"],
    queryFn: () => listFn() as Promise<HubEngine[]>,
  });

  const toggle = useMutation({
    mutationFn: (v: { slug: string; enabled: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hub-engines"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const activateAll = useMutation({
    mutationFn: () => activateAllFn({}),
    onSuccess: (r: any) => {
      toast.success(`تم تفعيل ${r.activated} محرك`);
      qc.invalidateQueries({ queryKey: ["hub-engines"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const enabledCount = engines.filter((e) => e.is_enabled).length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> محركات المنظومة
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {enabledCount}/{engines.length} مفعّل — سلسلة المعالجة الكاملة للـ Hub
          </p>
        </div>
        <Button
          onClick={() => activateAll.mutate()}
          disabled={activateAll.isPending}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
        >
          {activateAll.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          تفعيل جميع المحركات
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>
      ) : (
        <div className="grid gap-2">
          {engines.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 border rounded-lg p-3 hover:bg-muted/30 transition"
            >
              <div className="mt-0.5">
                {e.is_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {e.stage_order}. {e.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {e.slug}
                  </Badge>
                </div>
                {e.description && (
                  <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                )}
              </div>
              <Switch
                checked={e.is_enabled}
                disabled={toggle.isPending}
                onCheckedChange={(checked) =>
                  toggle.mutate({ slug: e.slug, enabled: checked })
                }
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
