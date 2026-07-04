import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listServices,
  approveService,
  rejectService,
  deleteService,
} from "@/lib/services.functions";
import { analyzeAllSites, importHnCatalog, linkConsumerSite } from "@/lib/discovery.functions";
import { checkServiceHealth } from "@/lib/monitoring.functions";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Boxes,
  Search,
  ExternalLink,
  MoreHorizontal,
  Activity,
  Check,
  X,
  Trash2,
  Shield,
  ShieldOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/services")({
  component: ServicesPage,
});

type Row = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  endpoint_path: string | null;
  method: string;
  api_required: boolean;
  is_active: boolean;
  approval_status: "approved" | "pending" | "rejected";
  confidence_score: number;
  last_tested_at: string | null;
  last_health_status: string | null;
  sites: {
    id: string;
    name: string;
    slug: string;
    base_url: string;
    logo_url: string | null;
    category: string | null;
  } | null;
};

type SortKey = "name" | "site" | "category" | "confidence_score" | "last_tested_at" | "approval_status";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "pending"
        ? "bg-amber-500/15 text-amber-400"
        : status === "rejected"
          ? "bg-red-500/15 text-red-400"
          : "bg-muted text-muted-foreground";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

function HealthPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    status === "online" || status === "ok"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-400"
        : "bg-red-500/15 text-red-400";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

function ScoreBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(value)}%</span>
    </div>
  );
}

function ServicesPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const fn = useServerFn(listServices);
  const approve = useServerFn(approveService);
  const reject = useServerFn(rejectService);
  const del = useServerFn(deleteService);
  const health = useServerFn(checkServiceHealth);
  const analyzeAll = useServerFn(analyzeAllSites);
  const importCatalog = useServerFn(importHnCatalog);
  const linkConsumer = useServerFn(linkConsumerSite);

  const { data = [] } = useQuery({ queryKey: ["services"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [consumerUrl, setConsumerUrl] = useState("https://prompt-build-magic-37.lovable.app");
  const perPage = 25;


  const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });

  const mApprove = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mReject = useMutation({
    mutationFn: (id: string) => reject({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success(t("saved")); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mHealth = useMutation({
    mutationFn: (id: string) => health({ data: { service_id: id } }),
    onSuccess: (r: any) => { toast.success(`${r.status} • ${r.latency_ms}ms`); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const mAnalyzeAll = useMutation({
    mutationFn: () => analyzeAll(),
    onSuccess: (r: any) => {
      toast.success(`تم تحليل ${r.analyzed}/${r.total} • خدمات جديدة: ${r.servicesCreated}${r.failed ? ` • فشل: ${r.failed}` : ""}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const mImportCatalog = useMutation({
    mutationFn: () => importCatalog(),
    onSuccess: (r: any) => {
      toast.success(`استيراد كتالوج HN: ${r.sites} موقع • ${r.services} خدمة`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });
  const mLinkConsumer = useMutation({
    mutationFn: (url: string) => linkConsumer({ data: { url } }),
    onSuccess: (r: any) => {
      toast.success(`تم ربط ${r.host} كمستهلك • ${r.linked_services} خدمة متاحة`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? t("somethingWentWrong")),
  });

  const rows = data as unknown as Row[];




  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "approved" && r.approval_status !== "approved") return false;
      if (statusFilter === "pending" && r.approval_status !== "pending") return false;
      if (statusFilter === "rejected" && r.approval_status !== "rejected") return false;
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (statusFilter === "api" && !r.api_required) return false;
      if (statusFilter === "no_api" && r.api_required) return false;
      if (!query) return true;
      return [r.name, r.category, r.description, r.endpoint_path, r.sites?.name, r.sites?.base_url]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [rows, q, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: any = "";
      let bv: any = "";
      switch (sortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "site": av = a.sites?.name ?? ""; bv = b.sites?.name ?? ""; break;
        case "category": av = a.category ?? ""; bv = b.category ?? ""; break;
        case "confidence_score": av = a.confidence_score; bv = b.confidence_score; break;
        case "last_tested_at": av = a.last_tested_at ?? ""; bv = b.last_tested_at ?? ""; break;
        case "approval_status": av = a.approval_status; bv = b.approval_status; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.approval_status === "pending").length,
    approved: rows.filter((r) => r.approval_status === "approved").length,
    rejected: rows.filter((r) => r.approval_status === "rejected").length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            {t("services")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} • <span className="text-amber-400">{stats.pending} pending</span> • <span className="text-emerald-400">{stats.approved} approved</span> • <span className="text-red-400">{stats.rejected} rejected</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => mImportCatalog.mutate()}
            disabled={mImportCatalog.isPending}
            className="gap-2"
          >
            {mImportCatalog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {mImportCatalog.isPending ? "جاري الاستيراد…" : "استيراد كتالوج HN (152 موقع)"}
          </Button>
          <Button
            onClick={() => mAnalyzeAll.mutate()}
            disabled={mAnalyzeAll.isPending}
            className="gap-2"
          >
            {mAnalyzeAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {mAnalyzeAll.isPending ? "جاري التحليل…" : "توليد: حلّل جميع المواقع"}
          </Button>
        </div>
      </div>

      <Card className="p-3 bg-card/60 backdrop-blur border-border/60">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="h-4 w-4 absolute top-2.5 start-3 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="api">API required</SelectItem>
              <SelectItem value="no_api">No API</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="bg-card/60 backdrop-blur border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => setSort("name")} className="cursor-pointer whitespace-nowrap">Service Name</TableHead>
                <TableHead onClick={() => setSort("site")} className="cursor-pointer whitespace-nowrap">Owner Site</TableHead>
                <TableHead className="whitespace-nowrap">Site URL</TableHead>
                <TableHead onClick={() => setSort("category")} className="cursor-pointer">Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="whitespace-nowrap">Endpoint</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>API</TableHead>
                <TableHead onClick={() => setSort("approval_status")} className="cursor-pointer">Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead onClick={() => setSort("confidence_score")} className="cursor-pointer">Confidence</TableHead>
                <TableHead onClick={() => setSort("last_tested_at")} className="cursor-pointer whitespace-nowrap">Last Tested</TableHead>
                <TableHead className="whitespace-nowrap">{t("usedBy")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("dependsOn")}</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} className="text-center text-sm text-muted-foreground py-10">
                    {t("noData")}
                  </TableCell>
                </TableRow>
              )}
              {paged.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium max-w-56 truncate">{r.name}</TableCell>
                  <TableCell>
                    {r.sites ? (
                      <Link to="/sites/$slug" params={{ slug: r.sites.slug }} className="text-primary hover:underline text-sm">
                        {r.sites.name}
                      </Link>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.sites?.base_url ? (
                      <a href={r.sites.base_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground max-w-40 truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.sites.base_url.replace(/^https?:\/\//, "")}</span>
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.category ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-64 truncate">{r.description ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs max-w-40 truncate">{r.endpoint_path ?? "—"}</TableCell>
                  <TableCell><span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">{r.method}</span></TableCell>
                  <TableCell>
                    {r.api_required ? <Shield className="h-3.5 w-3.5 text-emerald-400" /> : <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell><StatusBadge status={r.approval_status} /></TableCell>
                  <TableCell><HealthPill status={r.last_health_status} /></TableCell>
                  <TableCell><ScoreBar value={r.confidence_score ?? 0} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.last_tested_at ? new Date(r.last_tested_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(r as any).consumer_count > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{(r as any).consumer_count}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {Array.isArray((r as any).depends_on) && (r as any).depends_on.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(r as any).depends_on.map((sys: string) => (
                          <span key={sys} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{sys}</span>
                        ))}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => mHealth.mutate(r.id)}>
                          <Activity className="h-4 w-4 me-2" /> Test
                        </DropdownMenuItem>
                        {r.approval_status !== "approved" && (
                          <DropdownMenuItem onClick={() => mApprove.mutate(r.id)}>
                            <Check className="h-4 w-4 me-2 text-emerald-400" /> Approve
                          </DropdownMenuItem>
                        )}
                        {r.approval_status !== "rejected" && (
                          <DropdownMenuItem onClick={() => mReject.mutate(r.id)}>
                            <X className="h-4 w-4 me-2 text-amber-400" /> Reject
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => mDelete.mutate(r.id)} className="text-red-400">
                          <Trash2 className="h-4 w-4 me-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border/60 text-xs text-muted-foreground">
          <div>Showing {paged.length} of {sorted.length}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span>Page {page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
