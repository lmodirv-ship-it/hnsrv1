import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldCheck, Search, UserCog, Loader2 } from "lucide-react";
import {
  listAdminUsers,
  grantUserRole,
  revokeUserRole,
  type AdminUserRow,
} from "@/lib/admin-users.functions";

const ROLES = ["admin", "developer", "viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-red-500/15 text-red-400 border-red-500/30",
  developer: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  viewer: "bg-muted text-muted-foreground border-border",
};

export const Route = createFileRoute("/_authenticated/admin-users")({
  component: AdminUsersPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">
      {error instanceof Error ? error.message : "Error"}
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function AdminUsersPage() {
  const listFn = useServerFn(listAdminUsers);
  const grantFn = useServerFn(grantUserRole);
  const revokeFn = useServerFn(revokeUserRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const mutate = useMutation({
    mutationFn: async (v: { user_id: string; role: Role; enabled: boolean }) =>
      v.enabled
        ? grantFn({ data: { user_id: v.user_id, role: v.role } })
        : revokeFn({ data: { user_id: v.user_id, role: v.role } }),
    onSuccess: (_r, v) => {
      toast.success(v.enabled ? `Granted ${v.role}` : `Revoked ${v.role}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const filtered = useMemo(() => {
    const list: AdminUserRow[] = data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(s) ||
        (u.display_name ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            إدارة المالكين والصلاحيات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Owners & Roles — grant or revoke permissions per user.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
          >
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </div>
      )}
      {error && (
        <Card className="p-4 text-sm text-destructive">
          {(error as Error).message}
        </Card>
      )}

      {!isLoading && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Current roles</th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center p-3 capitalize">
                      {r}
                    </th>
                  ))}
                  <th className="text-left p-3">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {u.display_name ?? u.email ?? u.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={ROLE_COLOR[r as Role]}
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    {ROLES.map((r) => {
                      const enabled = u.roles.includes(r);
                      return (
                        <td key={r} className="text-center p-3">
                          <Switch
                            checked={enabled}
                            disabled={mutate.isPending}
                            onCheckedChange={(checked) =>
                              mutate.mutate({
                                user_id: u.id,
                                role: r,
                                enabled: checked,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="p-3 text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
