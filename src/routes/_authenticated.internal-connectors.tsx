import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  Network as NetworkIcon,
} from "lucide-react";
import {
  createInternalConnector,
  listInternalConnectors,
  listInternalSites,
  revokeInternalConnector,
} from "@/lib/internalConnectors.functions";

export const Route = createFileRoute("/_authenticated/internal-connectors")({
  component: InternalConnectorsPage,
});

function InternalConnectorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInternalConnectors);
  const sitesFn = useServerFn(listInternalSites);
  const createFn = useServerFn(createInternalConnector);
  const revokeFn = useServerFn(revokeInternalConnector);

  const { data: connectors = [] } = useQuery({
    queryKey: ["internal-connectors"],
    queryFn: () => listFn(),
  });
  const { data: sites = [] } = useQuery({
    queryKey: ["internal-connector-sites"],
    queryFn: () => sitesFn(),
  });

  const [siteId, setSiteId] = useState<string>("");
  const [name, setName] = useState("");
  const [trust, setTrust] = useState<"trusted" | "verified" | "restricted">("trusted");
  const [newToken, setNewToken] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (input: { site_id: string; name: string; trust_level: any }) =>
      createFn({ data: { ...input, allowed_internal_services: [] } }),
    onSuccess: (res: any) => {
      setNewToken(res.token);
      setName("");
      qc.invalidateQueries({ queryKey: ["internal-connectors"] });
      toast.success("Internal connector created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal-connectors"] });
      toast.success("Connector revoked");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const internalSites = useMemo(
    () => (sites as any[]).filter((s) => s.network_type === "internal" || s.layer !== "unclassified"),
    [sites],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          الاتصالات الداخلية — Internal HN Network
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          مواقع منظومة HN لا تحتاج مفتاح API خارجي. Hub يثق بها عبر توكن داخلي يصدر لكل موقع مسجّل في TVCC / HN Core.
          الطلب الداخلي يُرسل بترويستَي <code className="font-mono text-[10px]">X-Hn-Site-Id</code> و
          <code className="font-mono text-[10px]"> X-Hn-Internal-Token</code>.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4 text-primary" /> إصدار موصل داخلي جديد
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 space-y-1">
            <Label>الموقع (Internal HN Site)</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موقعًا من منظومة HN" />
              </SelectTrigger>
              <SelectContent>
                {internalSites.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    <span className="text-[10px] text-muted-foreground ms-2">
                      {s.layer} · {s.slug}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>اسم الموصل</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HN Build → Hub"
            />
          </div>
          <div className="space-y-1">
            <Label>مستوى الثقة</Label>
            <Select value={trust} onValueChange={(v: any) => setTrust(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trusted">Trusted</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!siteId || !name || createMut.isPending}
            onClick={() =>
              createMut.mutate({ site_id: siteId, name, trust_level: trust })
            }
          >
            <KeyRound className="h-4 w-4 me-2" />
            إصدار التوكن الداخلي
          </Button>
        </div>

        {newToken && (
          <div className="p-3 rounded-lg border border-primary/40 bg-primary/5 space-y-2">
            <div className="text-xs font-semibold text-primary">
              انسخ التوكن الآن — لن يُعرض مرة أخرى
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono break-all bg-background/60 p-2 rounded">
                {newToken}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>
                إغلاق
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              استخدمه في الترويسة: <code className="font-mono">X-Hn-Internal-Token: {newToken}</code>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <NetworkIcon className="h-4 w-4 text-primary" /> الموصلات الداخلية المسجّلة
        </div>
        {connectors.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">لا توجد موصلات بعد</div>
        ) : (
          <div className="divide-y divide-border/40">
            {(connectors as any[]).map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.sites?.name} · <span className="font-mono">{c.sites?.slug}</span> ·{" "}
                    <span className="font-mono">{c.token_prefix}…</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {c.trust_level}
                </Badge>
                <Badge
                  variant={c.connector_status === "active" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {c.connector_status}
                </Badge>
                <div className="text-[10px] text-muted-foreground">
                  {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : "unused"}
                </div>
                {c.connector_status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeMut.mutate(c.id)}
                    disabled={revokeMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
