import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSitesRich, createSite, deleteSite } from "@/lib/sites.functions";
import { syncSitesFromAllHubs } from "@/lib/integrations.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Globe,
  ExternalLink,
  RefreshCw,
  Loader2,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Zap,
  KeyRound,
  Activity,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sites/")({
  component: SitesPage,
});

type Row = {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  logo_url: string | null;
  category: string | null;
  status: string;
  services_count: number;
  api_status: "online" | "offline" | "warning" | "no_api";
  health_score: number | null;
  source: "TVCC" | "HN-DB" | "HN-Cloud" | "Manual";
  last_scan: string | null;
  last_error: string | null;
};

type Filter =
  | "all"
  | "online"
  | "offline"
  | "warning"
  | "connected"
  | "no_api"
  | "tvcc"
  | "manual";

type SortKey =
  | "name"
  | "base_url"
  | "category"
  | "status"
  | "source"
  | "services_count"
  | "api_status"
  | "health_score"
  | "last_scan";

const PAGE_SIZES = [25, 50, 100, 200];

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    inactive: "bg-muted text-muted-foreground border-border",
    online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    offline: "bg-red-500/15 text-red-400 border-red-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    no_api: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  const label: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    warning: "Warning",
    no_api: "No API",
    active: "Active",
    inactive: "Inactive",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${map[value] ?? map.inactive}`}
    >
      {label[value] ?? value}
    </span>
  );
}

function SourceBadge({ value }: { value: string }) {
  const cls =
    value === "TVCC"
      ? "bg-primary/15 text-primary border-primary/30"
      : value === "Manual"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>
      {value}
    </span>
  );
}

function HealthCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    score >= 80
      ? "text-emerald-400"
      : score >= 50
        ? "text-amber-400"
        : "text-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[70px]">
      <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
        <div
          className={`h-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${color}`}>{score}%</span>
    </div>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function SitesPage() {
  const { t, dir } = useLanguage();
  const qc = useQueryClient();
  const list = useServerFn(listSitesRich);
  const create = useServerFn(createSite);
  const del = useServerFn(deleteSite);
  const syncAll = useServerFn(syncSitesFromAllHubs);

  const { data: sites = [] } = useQuery<Row[]>({
    queryKey: ["sites-rich"],
    queryFn: () => list() as any,
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    base_url: "",
    description: "",
    category: "",
    logo_url: "",
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return sites.filter((s) => {
      if (ql) {
        const hay =
          `${s.name} ${s.slug} ${s.base_url} ${s.category ?? ""} ${s.source}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      switch (filter) {
        case "all":
          return true;
        case "online":
          return s.api_status === "online";
        case "offline":
          return s.api_status === "offline";
        case "warning":
          return s.api_status === "warning";
        case "connected":
          return s.api_status !== "no_api";
        case "no_api":
          return s.api_status === "no_api";
        case "tvcc":
          return s.source === "TVCC";
        case "manual":
          return s.source === "Manual";
      }
    });
  }, [sites, q, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(r.id));

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
      qc.invalidateQueries({ queryKey: ["sites-rich"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites-rich"] }),
  });

  const syncMut = useMutation({
    mutationFn: () => syncAll(),
    onSuccess: (r: any) => {
      toast.success(`+${r.inserted} / ~${r.updated}`);
      qc.invalidateQueries({ queryKey: ["sites-rich"] });
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function togglePageSelect() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((r) => next.delete(r.id));
      else paged.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function exportCsv() {
    const rows = selected.size ? sorted.filter((r) => selected.has(r.id)) : sorted;
    const cols: (keyof Row)[] = [
      "name",
      "slug",
      "base_url",
      "category",
      "status",
      "source",
      "services_count",
      "api_status",
      "health_score",
      "last_scan",
      "last_error",
    ];
    const csv = [
      cols.join(","),
      ...rows.map((r) =>
        cols
          .map((c) => {
            const v = (r as any)[c];
            const s = v == null ? "" : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "online", label: "Online" },
    { key: "offline", label: "Offline" },
    { key: "warning", label: "Warning" },
    { key: "connected", label: "Connected" },
    { key: "no_api", label: "No API" },
    { key: "tvcc", label: "From TVCC" },
    { key: "manual", label: "Manual" },
  ];

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-primary transition text-xs font-medium uppercase tracking-wide"
      >
        {label}
        <Icon className="h-3 w-3 opacity-70" />
      </button>
    );
  }

  const bulkCount = selected.size;

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("sites")}</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} / {sites.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ms-1">Sync all hubs</span>
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            <span className="ms-1">Export</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                <span className="ms-1">{t("addSite")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addSite")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("name")}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t("slug")}</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("baseUrl")}</Label>
                  <Input
                    type="url"
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("category")}</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <Label>{t("logoUrl")}</Label>
                  <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
                </div>
                <div>
                  <Label>{t("description")}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending}
                >
                  {t("save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-3 bg-card/60 backdrop-blur border-border/60 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search name, url, category…"
              className="ps-9"
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(0);
              }}
              className={`text-xs px-2.5 py-1 rounded-md border transition ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {bulkCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <span className="font-medium">{bulkCount} selected</span>
            <div className="ms-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline">
                <Activity className="h-3.5 w-3.5" />
                <span className="ms-1">Scan Selected</span>
              </Button>
              <Button size="sm" variant="outline">
                <Zap className="h-3.5 w-3.5" />
                <span className="ms-1">Test Connections</span>
              </Button>
              <Button size="sm" variant="outline">
                <KeyRound className="h-3.5 w-3.5" />
                <span className="ms-1">Generate API Keys</span>
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
                <span className="ms-1">Export</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-card/60 backdrop-blur border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={togglePageSelect}
                    aria-label="Select page"
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>
                  <SortHeader label="Site" k="name" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Base URL" k="base_url" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Category" k="category" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Status" k="status" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Source" k="source" />
                </TableHead>
                <TableHead className="text-center">
                  <SortHeader label="Services" k="services_count" />
                </TableHead>
                <TableHead>
                  <SortHeader label="API" k="api_status" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Health" k="health_score" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Last Scan" k="last_scan" />
                </TableHead>
                <TableHead>Last Error</TableHead>
                <TableHead className="w-10 text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12 text-sm text-muted-foreground">
                    {t("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((s) => (
                  <TableRow
                    key={s.id}
                    className={`border-border/60 ${selected.has(s.id) ? "bg-primary/5" : ""}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(s.id);
                            else next.delete(s.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${s.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt=""
                          className="h-7 w-7 rounded object-cover border border-border/60"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
                          <Globe className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/sites/$slug"
                        params={{ slug: s.slug }}
                        className="font-medium hover:text-primary block max-w-[240px] truncate"
                      >
                        {s.name}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate max-w-[240px]">{s.slug}</div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={s.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 max-w-[220px] truncate"
                      >
                        <span className="truncate">{s.base_url.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {s.category ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {s.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={s.status || "inactive"} />
                    </TableCell>
                    <TableCell>
                      <SourceBadge value={s.source} />
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-sm">
                      {s.services_count}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={s.api_status} />
                    </TableCell>
                    <TableCell>
                      <HealthCell score={s.health_score} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(s.last_scan)}
                    </TableCell>
                    <TableCell>
                      {s.last_error ? (
                        <span
                          className="text-xs text-red-400 max-w-[200px] truncate inline-block align-middle"
                          title={s.last_error}
                        >
                          {s.last_error}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>{s.name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDetail(s)}>
                            <Eye className="h-4 w-4 me-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Scan queued")}>
                            <Activity className="h-4 w-4 me-2" />
                            Scan
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/sites/$slug" params={{ slug: s.slug }}>
                              <Zap className="h-4 w-4 me-2" />
                              Services
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Open API Console")}>
                            <KeyRound className="h-4 w-4 me-2" />
                            Create API Key
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Testing…")}>
                            <Zap className="h-4 w-4 me-2" />
                            Test
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() => deleteMut.mutate(s.id)}
                          >
                            <Trash2 className="h-4 w-4 me-2" />
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <div>
            Page {page + 1} of {pageCount} · {sorted.length} rows
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.logo_url ? (
                    <img src={detail.logo_url} alt="" className="h-6 w-6 rounded" />
                  ) : (
                    <Globe className="h-5 w-5 text-primary" />
                  )}
                  {detail.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <StatusBadge value={detail.status || "inactive"} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">API</div>
                    <StatusBadge value={detail.api_status} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Health</div>
                    <HealthCell score={detail.health_score} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Source</div>
                    <SourceBadge value={detail.source} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Services</div>
                    <div className="tabular-nums">{detail.services_count}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div>{detail.category ?? "—"}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Base URL</div>
                    <a
                      href={detail.base_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm inline-flex items-center gap-1"
                    >
                      {detail.base_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                {detail.last_error && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <div className="font-medium mb-1">Last error</div>
                    {detail.last_error}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/sites/$slug" params={{ slug: detail.slug }}>
                      Full page →
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("Scan queued")}>
                    Scan now
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toast.info("Testing…")}>
                    Health check
                  </Button>
                </div>
                <div className="rounded border border-border/60 p-3 text-xs text-muted-foreground">
                  Discovered services, API endpoints, linked keys, dependent sites, request logs,
                  and knowledge profile appear on the full site page.
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
