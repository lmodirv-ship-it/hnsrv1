import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listServices } from "@/lib/services.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Boxes, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useLanguage();
  const fn = useServerFn(listServices);
  const { data = [] } = useQuery({ queryKey: ["services"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    if (!query) return data;
    return data.filter((s: any) =>
      [s.name, s.category, s.description, s.sites?.name, ...(s.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" />{t("services")}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute top-2.5 start-3 text-muted-foreground" />
          <Input className="ps-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {!filtered.length ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("noData")}</Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((s: any) => (
            <Card key={s.id} className="p-4 bg-card/60 backdrop-blur border-border/60 hover:border-primary/50 transition">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/15 text-primary">{s.method}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${s.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {s.is_active ? t("active") : t("inactive")}
                </span>
                {s.category && <span className="text-xs text-muted-foreground">{s.category}</span>}
              </div>
              <div className="font-semibold">{s.name}</div>
              {s.sites?.slug && (
                <Link to="/sites/$slug" params={{ slug: s.sites.slug }} className="text-xs text-primary hover:underline">{s.sites.name}</Link>
              )}
              {s.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.description}</p>}
              {s.tags?.length ? (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {s.tags.map((tag: string) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>)}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
