import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  KeyRound,
  Zap,
  RefreshCw,
  Users,
  History,
  Crown,
  Power,
  Database,
  Compass,
} from "lucide-react";
import {
  whoAmI,
  listPlatformSettings,
  updatePlatformSetting,
  recentAdminActions,
  claimFirstAdmin,
  recordAdminAction,
} from "@/lib/owner-panel.functions";
import { activateAllTasks } from "@/lib/activate-tasks.functions";
import { provisionMeshKeys } from "@/lib/apiClients.functions";
import { syncSchemaMirror } from "@/lib/schema-mirror.functions";
import { Link } from "@tanstack/react-router";

const SETTING_ICONS: Record<string, React.ReactNode> = {
  payments_enabled: <KeyRound className="h-4 w-4" />,
  discovery_auto: <Compass className="h-4 w-4" />,
  mirror_auto: <Database className="h-4 w-4" />,
  agents_enabled: <Zap className="h-4 w-4" />,
  maintenance_mode: <Power className="h-4 w-4" />,
  public_signup: <Users className="h-4 w-4" />,
};

const SETTING_LABELS: Record<string, string> = {
  payments_enabled: "المدفوعات (Paddle)",
  discovery_auto: "الاكتشاف التلقائي",
  mirror_auto: "الازدواجية التلقائية",
  agents_enabled: "الوكلاء (Agents)",
  maintenance_mode: "وضع الصيانة",
  public_signup: "التسجيل العام",
};

export function OwnerPanel() {
  const qc = useQueryClient();
  const who = useServerFn(whoAmI);
  const list = useServerFn(listPlatformSettings);
  const upd = useServerFn(updatePlatformSetting);
  const actions = useServerFn(recentAdminActions);
  const claim = useServerFn(claimFirstAdmin);
  const record = useServerFn(recordAdminAction);

  const activateAll = useServerFn(activateAllTasks);
  const provisionMesh = useServerFn(provisionMeshKeys);
  const syncMirror = useServerFn(syncSchemaMirror);

  const { data: me, refetch: refetchMe } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => who(),
  });
  const isAdmin = !!me?.is_admin;

  const { data: settings = [] } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => list(),
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["admin-actions"],
    queryFn: () => actions(),
    enabled: isAdmin,
  });

  const toggleMut = useMutation({
    mutationFn: (input: { key: string; value: Record<string, unknown> }) =>
      upd({ data: input }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-actions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimMut = useMutation({
    mutationFn: () => claim(),
    onSuccess: () => {
      toast.success("تم منحك دور Admin");
      refetchMe();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAction = async (
    label: string,
    fn: () => Promise<Record<string, unknown>>,
    target?: string,
  ) => {
    try {
      const result = await fn();
      await record({
        data: { action: label, target: target ?? null, payload: {}, result, status: "success" },
      }).catch(() => void 0);
      toast.success(`${label}: تم`);
      qc.invalidateQueries({ queryKey: ["admin-actions"] });
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      await record({
        data: { action: label, target: target ?? null, payload: {}, result: { error: msg }, status: "failed" },
      }).catch(() => void 0);
      toast.error(`${label}: ${msg}`);
    }
  };

  const settingsMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of settings) m.set(s.key, s);
    return m;
  }, [settings]);

  return (
    <Card className="border-primary/40 bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">لوحة تحكم المالك</h2>
        {isAdmin ? (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" /> Admin
          </Badge>
        ) : (
          <Badge variant="secondary">
            {me?.roles?.join(", ") || "no role"}
          </Badge>
        )}
        <div className="ml-auto text-xs text-muted-foreground" dir="ltr">
          {me?.email}
        </div>
      </div>

      {!isAdmin && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="mb-2 font-medium">لست مالكاً بعد</div>
          <p className="mb-2 text-xs text-muted-foreground">
            إذا لم يكن هناك أدمن في النظام بعد، يمكنك المطالبة بدور المالك الأول (يعمل مرة واحدة فقط).
          </p>
          <Button
            size="sm"
            variant="default"
            onClick={() => claimMut.mutate()}
            disabled={claimMut.isPending}
          >
            {claimMut.isPending ? "..." : "طالِب بدور المالك الأول"}
          </Button>
        </div>
      )}

      {/* Feature toggles */}
      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">مفاتيح المنصة</div>
        <div className="grid gap-2">
          {settings.map((s: any) => {
            const enabled = !!s.value?.enabled;
            return (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/40 p-3"
              >
                <div className="flex items-center gap-3">
                  {SETTING_ICONS[s.key]}
                  <div>
                    <div className="text-sm font-medium">
                      {SETTING_LABELS[s.key] ?? s.key}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`sw-${s.key}`} className="text-xs">
                    {enabled ? "مفعّل" : "معطّل"}
                  </Label>
                  <Switch
                    id={`sw-${s.key}`}
                    checked={enabled}
                    disabled={!isAdmin || toggleMut.isPending}
                    onCheckedChange={(v) =>
                      toggleMut.mutate({
                        key: s.key,
                        value: { ...(s.value ?? {}), enabled: v },
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-muted-foreground">إجراءات المالك</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start"
            disabled={!isAdmin}
            onClick={() =>
              runAction("activate_all_tasks", async () => (await activateAll()) as any)
            }
          >
            <Zap className="mr-2 h-4 w-4" /> تفعيل كل المهام
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            disabled={!isAdmin}
            onClick={() =>
              runAction("provision_mesh_keys", async () => (await provisionMesh()) as any)
            }
          >
            <KeyRound className="mr-2 h-4 w-4" /> إصدار مفاتيح المواقع
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            disabled={!isAdmin}
            onClick={() =>
              runAction(
                "sync_mirror_hn_db",
                async () =>
                  (await syncMirror({ data: { target_name: "hn-db" } })) as any,
                "hn-db",
              )
            }
          >
            <Database className="mr-2 h-4 w-4" /> مزامنة مرآة HN-DB
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            disabled={!isAdmin}
            onClick={() =>
              runAction(
                "sync_mirror_hn_cloud",
                async () =>
                  (await syncMirror({ data: { target_name: "hn-cloud" } })) as any,
                "hn-cloud",
              )
            }
          >
            <RefreshCw className="mr-2 h-4 w-4" /> مزامنة مرآة HN-Cloud
          </Button>
          <Button variant="outline" className="justify-start" asChild disabled={!isAdmin}>
            <Link to="/admin-users">
              <Users className="mr-2 h-4 w-4" /> إدارة المستخدمين والأدوار
            </Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link to="/domain-verify">
              <ShieldCheck className="mr-2 h-4 w-4" /> التحقق من ملكية النطاق
            </Link>
          </Button>
        </div>
      </div>

      {/* Audit log */}
      {isAdmin && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="h-4 w-4" /> آخر 50 إجراء
          </div>
          {audit.length === 0 ? (
            <div className="text-xs italic text-muted-foreground">لا توجد إجراءات مسجّلة بعد.</div>
          ) : (
            <div className="max-h-64 overflow-auto rounded-md border border-border/50 bg-background/40">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-right">
                    <th className="p-2">الوقت</th>
                    <th className="p-2">الإجراء</th>
                    <th className="p-2">الهدف</th>
                    <th className="p-2">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a: any) => (
                    <tr key={a.id} className="border-t border-border/40">
                      <td className="p-2 text-muted-foreground" dir="ltr">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="p-2 font-mono" dir="ltr">
                        {a.action}
                      </td>
                      <td className="p-2 font-mono text-muted-foreground" dir="ltr">
                        {a.target ?? "—"}
                      </td>
                      <td className="p-2">
                        <Badge variant={a.status === "success" ? "default" : "destructive"}>
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
