import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listClients, createClient, deleteClient, issueKey, revokeKey, recentRequests } from "@/lib/apiClients.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Copy, Check, Ban } from "lucide-react";
import { GenerateButton } from "@/components/generate-button";

import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/api-console")({
  component: ApiConsolePage,
});

function ApiConsolePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const list = useServerFn(listClients);
  const create = useServerFn(createClient);
  const del = useServerFn(deleteClient);
  const issue = useServerFn(issueKey);
  const revoke = useServerFn(revokeKey);
  const logsFn = useServerFn(recentRequests);

  const { data: clients = [] } = useQuery({ queryKey: ["api-clients"], queryFn: () => list() });
  const { data: logs = [] } = useQuery({ queryKey: ["req-logs"], queryFn: () => logsFn() });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState(60);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMut = useMutation({
    mutationFn: () => create({ data: { name, description: null, rate_limit_per_min: rate, allowed_services: [] } }),
    onSuccess: () => { setOpen(false); setName(""); qc.invalidateQueries({ queryKey: ["api-clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const issueMut = useMutation({
    mutationFn: (client_id: string) => issue({ data: { client_id } }),
    onSuccess: (r) => { setNewKey(r.key); qc.invalidateQueries({ queryKey: ["api-clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-clients"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-clients"] }),
  });

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("apiConsole")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <GenerateButton
            label="توليد: عميل + مفتاح API"
            pendingLabel="جاري التوليد…"
            onGenerate={async () => {
              const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
              const created = await create({ data: { name: `Client ${stamp}`, description: null, rate_limit_per_min: 60, allowed_services: [] } });
              const key = await issue({ data: { client_id: (created as any).id } });
              return key;
            }}
            onDone={(r: any) => { setNewKey(r.key); qc.invalidateQueries({ queryKey: ["api-clients"] }); }}
            successMessage={() => "تم إنشاء عميل جديد ومفتاح API"}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4" />{t("createClient")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("createClient")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>{t("rateLimitPerMin")}</Label><Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
                <Button className="w-full" onClick={() => createMut.mutate()} disabled={!name || createMut.isPending}>{t("save")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>


      <Card className="p-4 bg-primary/5 border-primary/30">
        <div className="text-sm">
          <div className="font-semibold text-primary flex items-center gap-2">{t("publicApi")}</div>
          <code className="text-xs block mt-2 text-muted-foreground break-all">{t("publicApiHint")}</code>
        </div>
      </Card>

      {newKey && (
        <Card className="p-4 border-amber-500/50 bg-amber-500/5">
          <div className="text-sm font-semibold text-amber-400">{t("keyOnceWarning")}</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-background/50 px-3 py-2 rounded break-all">{newKey}</code>
            <Button size="sm" variant="outline" onClick={copyKey}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t("copied") : t("copy")}</Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewKey(null)}>{t("cancel")}</Button>
        </Card>
      )}

      {!clients.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("noKey")}</Card>
      ) : (
        <div className="space-y-3">
          {clients.map((c: any) => (
            <Card key={c.id} className="p-5 bg-card/60 backdrop-blur border-border/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{t("rateLimitPerMin")}: {c.rate_limit_per_min}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => issueMut.mutate(c.id)} disabled={issueMut.isPending}><KeyRound className="h-4 w-4" />{t("createKey")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => delMut.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {c.api_keys?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {c.api_keys.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between text-xs bg-background/40 px-3 py-2 rounded">
                      <code className="font-mono">{k.key_prefix}…</code>
                      <div className="flex items-center gap-2">
                        {k.revoked_at ? (
                          <span className="text-red-400">revoked</span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(k.id)}><Ban className="h-3 w-3" />{t("revoke")}</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-2">{t("recentRequests")}</h2>
        {!logs.length ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("noData")}</Card>
        ) : (
          <Card className="p-4 bg-card/60 backdrop-blur border-border/60">
            <div className="space-y-1 text-sm">
              {logs.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${r.status_code && r.status_code < 400 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{r.status_code ?? "—"}</span>
                    <span>{r.services?.name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{r.api_clients?.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.latency_ms ?? 0}ms</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
