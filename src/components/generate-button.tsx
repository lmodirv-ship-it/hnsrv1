import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = {
  label?: string;
  pendingLabel?: string;
  onGenerate: () => Promise<unknown>;
  onDone?: (result: unknown) => void;
  successMessage?: (r: any) => string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
};

/**
 * زر توليد موحّد لكل صفحات لوحة التحكم.
 * كل صفحة تمرّر مهمّتها (server function call) وتحصل على toast + loading + icon.
 */
export function GenerateButton({
  label = "توليد",
  pendingLabel = "جاري التوليد…",
  onGenerate,
  onDone,
  successMessage,
  variant = "default",
  className,
}: Props) {
  const m = useMutation({
    mutationFn: () => onGenerate(),
    onSuccess: (r) => {
      toast.success(successMessage ? successMessage(r) : "تم التوليد بنجاح");
      onDone?.(r);
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل التوليد"),
  });

  return (
    <Button
      variant={variant}
      className={`gap-2 ${className ?? ""}`}
      onClick={() => m.mutate()}
      disabled={m.isPending}
    >
      {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {m.isPending ? pendingLabel : label}
    </Button>
  );
}
