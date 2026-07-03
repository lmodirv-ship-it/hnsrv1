import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSites, createSite, deleteSite } from "@/lib/sites.functions";
import { syncSitesFromAllHubs } from "@/lib/integrations.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Globe, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites/")({
  component: SitesPage,
});

function SitesPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const list = useServerFn(listSites);
  const create = useServerFn(createSite);
  const del = useServerFn(deleteSite);
  const syncAll = useServerFn(syncSitesFromAllHubs);

  const { data: sites = [] } = useQuery({ queryKey: ["sites"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", base_url: "", description: "", category: "", logo_url: "" });

  const createMut = useMutation({
    mutationFn: async () =>
      create({
        data: {
          name: form.name,
          slug: form.slug,
          base_url: form.base_url,
          description: form.description || null,
          category: form.category || null,
          logo_url: form.logo_url || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("saved"));
      setOpen(false);
      setForm({ name: "", slug: "", base_url: "", description: "", category: "", logo_url: "" });
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });

  const syncMut = useMutation({
    mutationFn: () => syncAll(),
    onSuccess: (r: any) => {
      const parts = (r.results ?? [])
        .map((x: any) => (x.ok ? `${x.hub}: +${x.inserted}/~${x.updated}` : `${x.hub}: ${x.reason}`))
        .join(" · ");
      toast.success(`+${r.inserted} / ~${r.updated} — ${parts}`);
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("sites")}</h1>
          <p className="text-sm text-muted-foreground">{sites.length}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />{t("addSite")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addSite")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("slug")}</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              <div><Label>{t("baseUrl")}</Label><Input type="url" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} /></div>
              <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>{t("logoUrl")}</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
              <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={() => createMut.mutate()} disabled={createMut.isPending}>{t("save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!sites.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("noData")}</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((s: any) => (
            <Card key={s.id} className="p-5 bg-card/60 backdrop-blur border-border/60 hover:border-primary/50 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center"><Globe className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="min-w-0">
                    <Link to="/sites/$slug" params={{ slug: s.slug }} className="font-semibold hover:text-primary truncate block">{s.name}</Link>
                    <div className="text-xs text-muted-foreground truncate">{s.slug}</div>
                  </div>
                </div>
                <a href={s.base_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>
              </div>
              {s.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{s.description}</p>}
              <div className="flex items-center justify-between mt-4">
                <span className={`text-xs px-2 py-0.5 rounded ${s.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{s.status === "active" ? t("active") : t("inactive")}</span>
                <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
