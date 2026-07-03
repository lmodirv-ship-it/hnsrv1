import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSiteBySlug } from "@/lib/sites.functions";
import { createService, deleteService } from "@/lib/services.functions";
import { checkServiceHealth } from "@/lib/monitoring.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowLeft, Boxes, Trash2, Activity } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites/$slug")({
  component: SiteDetail,
});

function SiteDetail() {
  const { slug } = Route.useParams();
  const { t, dir } = useLanguage();
  const qc = useQueryClient();
  const fn = useServerFn(getSiteBySlug);
  const createSvc = useServerFn(createService);
  const delSvc = useServerFn(deleteService);
  const health = useServerFn(checkServiceHealth);

  const { data } = useQuery({ queryKey: ["site", slug], queryFn: () => fn({ data: { slug } }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", category: "", method: "POST" as const, endpoint_path: "", description: "", tags: "" });

  const create = useMutation({
    mutationFn: async () =>
      createSvc({
        data: {
          site_id: data!.site.id,
          name: form.name,
          slug: form.slug,
          category: form.category || null,
          method: form.method,
          endpoint_path: form.endpoint_path || null,
          description: form.description || null,
          tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
          is_active: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("saved"));
      setOpen(false);
      setForm({ name: "", slug: "", category: "", method: "POST", endpoint_path: "", description: "", tags: "" });
      qc.invalidateQueries({ queryKey: ["site", slug] });
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const del = useMutation({
    mutationFn: (id: string) => delSvc({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site", slug] }),
  });

  const check = useMutation({
    mutationFn: (id: string) => health({ data: { service_id: id } }),
    onSuccess: (r) => toast.success(`${t(r.status as any) || r.status} • ${r.latency_ms}ms`),
    onError: (e: any) => toast.error(e.message),
  });

  if (!data) return <div className="text-sm text-muted-foreground">…</div>;
  const site = data.site;

  return (
    <div className="space-y-6">
      <Link to="/sites" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />{t("backToSites")}
      </Link>

      <Card className="p-6 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-start gap-4">
          {site.logo_url ? <img src={site.logo_url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-primary/15 border border-primary/30" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <a href={site.base_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{site.base_url}</a>
            {site.description && <p className="text-sm text-muted-foreground mt-2">{site.description}</p>}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><Boxes className="h-4 w-4" />{t("services")} ({data.services.length})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{t("addService")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addService")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("slug")}</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>{t("endpoint")}</Label><Input placeholder="/api/generate" value={form.endpoint_path} onChange={(e) => setForm({ ...form, endpoint_path: e.target.value })} /></div>
              <div><Label>{t("tags")}</Label><Input placeholder="ai, image, logo" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
              <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>{t("save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!data.services.length ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("noData")}</Card>
      ) : (
        <div className="space-y-2">
          {data.services.map((s: any) => (
            <Card key={s.id} className="p-4 bg-card/60 backdrop-blur border-border/60 flex items-center gap-4">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/15 text-primary">{s.method}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.endpoint_path ?? "—"}</div>
                {s.tags?.length ? (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.tags.map((tag: string) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>)}
                  </div>
                ) : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => check.mutate(s.id)}><Activity className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
