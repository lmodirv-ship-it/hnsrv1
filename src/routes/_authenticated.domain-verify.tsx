import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Copy, ShieldCheck } from "lucide-react";
import {
  getDomainVerificationRecord,
  verifyDomainRecord,
} from "@/lib/domain-verification.functions";

export const Route = createFileRoute("/_authenticated/domain-verify")({
  component: DomainVerifyPage,
  head: () => ({
    meta: [{ title: "التحقق من ملكية النطاق — HN Service Hub" }],
  }),
});

function DomainVerifyPage() {
  const [domain, setDomain] = useState("");
  const [record, setRecord] = useState<null | {
    host: string;
    value: string;
    type: string;
    ttl: number;
  }>(null);
  const [verifyResult, setVerifyResult] = useState<null | {
    matched: boolean;
    answers: string[];
  }>(null);

  const getRecord = useServerFn(getDomainVerificationRecord);
  const verify = useServerFn(verifyDomainRecord);

  const genMut = useMutation({
    mutationFn: (d: string) => getRecord({ data: { domain: d } }),
    onSuccess: (r) => {
      setRecord(r.record);
      setVerifyResult(null);
      toast.success("تم توليد السجل");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMut = useMutation({
    mutationFn: (d: string) => verify({ data: { domain: d } }),
    onSuccess: (r) => {
      setVerifyResult({ matched: r.matched, answers: r.answers });
      if (r.matched) toast.success("تم التحقق من ملكية النطاق ✓");
      else toast.error("لم يُعثر على السجل في DNS بعد");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("نُسخ إلى الحافظة");
  };

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">التحقق من ملكية النطاق</h1>
          <p className="text-sm text-muted-foreground">
            أضف سجل TXT في DNS للنطاق ليتم ربطه رسمياً بمنصة HN Hub تحت لواء TVCC.
          </p>
        </div>
      </div>

      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="domain">النطاق (بدون https://)</Label>
          <div className="flex gap-2">
            <Input
              id="domain"
              placeholder="example.hn-network.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              dir="ltr"
            />
            <Button
              onClick={() => genMut.mutate(domain.trim())}
              disabled={!domain.trim() || genMut.isPending}
            >
              {genMut.isPending ? "..." : "توليد السجل"}
            </Button>
          </div>
        </div>
      </Card>

      {record && (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">أضف هذا السجل في DNS</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4" dir="ltr">
            <Field label="Type" value={record.type} />
            <Field label="Host / Name" value={record.host} onCopy={() => copy(record.host)} />
            <Field label="Value" value={record.value} onCopy={() => copy(record.value)} />
            <Field label="TTL" value={String(record.ttl)} />
          </div>
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            ⚠️ قد يستغرق انتشار DNS من دقائق إلى 72 ساعة. اضغط "تحقّق" بعد إضافة السجل.
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => verifyMut.mutate(domain.trim())}
              disabled={verifyMut.isPending}
            >
              {verifyMut.isPending ? "جاري التحقق..." : "تحقّق الآن"}
            </Button>
            {verifyResult && (
              <Badge variant={verifyResult.matched ? "default" : "destructive"} className="gap-1">
                {verifyResult.matched ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> متحقّق
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> غير موجود
                  </>
                )}
              </Badge>
            )}
          </div>
          {verifyResult && verifyResult.answers.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                استجابة DNS الخام
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-muted p-2" dir="ltr">
                {verifyResult.answers.join("\n")}
              </pre>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{value}</code>
        {onCopy && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
