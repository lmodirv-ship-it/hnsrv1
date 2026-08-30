import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fingerprint, Copy, Ban, RefreshCw } from "lucide-react";
import {
  listIdentifiers,
  listIdentifierSignals,
  issueIdentifier,
  revokeIdentifier,
} from "@/lib/group-identity.functions";
import { listSites } from "@/lib/sites.functions";

export const Route = createFileRoute("/_authenticated/identities")({
  component: IdentitiesPage,
  head: () => ({
    meta: [
      { title: "معرّفات المجموعة — HN Service Hub" },
      {
        name: "description",
        content: "إصدار وإدارة معرّفات مجموعة HN الفريدة وربط المواقع بمركز TVCC.",
      },
      { property: "og:title", content: "معرّفات المجموعة — HN Service Hub" },
      {
        property: "og:description",
        content: "إصدار وإدارة معرّفات مجموعة HN الفريدة وربط المواقع بمركز TVCC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const HUB = "https://hnsrv1.lovable.app";

function IdentitiesPage() {
  const qc = useQueryClient();
  const fetchIdentifiers = useServerFn(listIdentifiers);
  const fetchSignals = useServerFn(listIdentifierSignals);
  const fetchSites = useServerFn(listSites);
  const issue = useServerFn(issueIdentifier);
  const revoke = useServerFn(revokeIdentifier);

  const [serviceName, setServiceName] = useState("");
  const [siteId, setSiteId] = useState<string>("none");
  const [siteUrl, setSiteUrl] = useState("");

  const identifiers = useQuery({ queryKey: ["group-identifiers"], queryFn: () => fetchIdentifiers() });
  const signals = useQuery({
    queryKey: ["group-identifier-signals"],
    queryFn: () => fetchSignals({ data: {} }),
  });
  const sites = useQuery({ queryKey: ["sites-basic"], queryFn: () => fetchSites() });

  const issueMut = useMutation({
    mutationFn: () =>
      issue({
        data: {
          service_name: serviceName.trim(),
          site_id: siteId === "none" ? null : siteId,
          site_url: siteUrl.trim() ? siteUrl.trim() : null,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`تم إصدار الهوية ${r.code}`);
      setServiceName("");
      setSiteUrl("");
      setSiteId("none");
      qc.invalidateQueries({ queryKey: ["group-identifiers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("تم إلغاء الهوية");
      qc.invalidateQueries({ queryKey: ["group-identifiers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string, msg = "نُسخ إلى الحافظة") => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const embedFor = (code: string) =>
    `<div data-hn-id="${code}"></div>\n<script src="${HUB}/api/public/v1/identity/embed.js" defer></script>`;

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Fingerprint className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">معرّفات المجموعة (Group IDs)</h1>
          <p className="text-sm text-muted-foreground">
            رمز فريد بصيغة حرف + ستة أرقام لكل موقع أو خدمة داخل مجموعة HN، مع زر اتصال يرسل
            إشارة إلى TVCC مركز المجموعة.
          </p>
        </div>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">إصدار هوية جديدة</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="svc">اسم الخدمة</Label>
            <Input
              id="svc"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="مثال: بوابة الدفع"
            />
          </div>
          <div className="space-y-2">
            <Label>الموقع</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موقعاً" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون موقع</SelectItem>
                {(sites.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">رابط الموقع (اختياري)</Label>
            <Input
              id="url"
              dir="ltr"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
        <Button
          onClick={() => issueMut.mutate()}
          disabled={!serviceName.trim() || issueMut.isPending}
        >
          {issueMut.isPending ? "جارٍ الإصدار..." : "إصدار هوية"}
        </Button>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">الهويات المسجّلة</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              identifiers.refetch();
              signals.refetch();
            }}
          >
            <RefreshCw className="ml-1 h-4 w-4" /> تحديث
          </Button>
        </div>
        {identifiers.isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : (identifiers.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد هويات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="p-2 text-right">الرمز</th>
                  <th className="p-2 text-right">رقم الخدمة</th>
                  <th className="p-2 text-right">اسم الخدمة</th>
                  <th className="p-2 text-right">الموقع</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">آخر إشارة</th>
                  <th className="p-2 text-right">TVCC</th>
                  <th className="p-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(identifiers.data ?? []).map((row: any) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-2 font-mono font-semibold" dir="ltr">
                      {row.code}
                    </td>
                    <td className="p-2">{row.service_number}</td>
                    <td className="p-2">{row.service_name}</td>
                    <td className="p-2">{row.sites?.name ?? row.site_url ?? "—"}</td>
                    <td className="p-2">
                      <Badge
                        variant={
                          row.status === "connected"
                            ? "default"
                            : row.status === "revoked"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {row.status === "connected"
                          ? "متصل"
                          : row.status === "revoked"
                            ? "ملغى"
                            : "صادر"}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground" dir="ltr">
                      {row.last_signal_at
                        ? new Date(row.last_signal_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground" dir="ltr">
                      {row.last_tvcc_status ?? "—"}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(row.code, "نُسخ الرمز")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copy(embedFor(row.code), "نُسخ كود التضمين")}
                        >
                          كود التضمين
                        </Button>
                        {row.status !== "revoked" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeMut.mutate(row.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">سجل الإشارات (آخر 50)</h2>
        {(signals.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد إشارات بعد.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(signals.data ?? []).map((s: any) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2"
              >
                <span dir="ltr" className="font-mono text-xs">
                  {new Date(s.created_at).toLocaleString()}
                </span>
                <span dir="ltr" className="text-xs text-muted-foreground">
                  {s.origin ?? "—"}
                </span>
                <Badge variant={s.forwarded_to_tvcc ? "default" : "secondary"}>
                  {s.forwarded_to_tvcc ? "أُرسلت إلى TVCC" : "محلية"}
                </Badge>
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {s.tvcc_status ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-6 text-sm">
        <h2 className="text-lg font-semibold">نقاط النهاية العامة</h2>
        <p dir="ltr" className="font-mono text-xs">
          GET {HUB}/api/public/v1/identity/&lt;CODE&gt;
        </p>
        <p dir="ltr" className="font-mono text-xs">
          POST {HUB}/api/public/v1/identity/announce
        </p>
        <p dir="ltr" className="font-mono text-xs">
          GET {HUB}/api/public/v1/identity/embed.js
        </p>
      </Card>
    </div>
  );
}
