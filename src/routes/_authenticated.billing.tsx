import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  listProducts,
  listMySubscriptions,
  listMyTransactions,
} from "@/lib/billing.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Package, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — HN Service Hub" },
      { name: "description", content: "Manage plans, subscriptions and invoices." },
    ],
  }),
  component: BillingPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="text-destructive">{error.message}</p>
      <Button onClick={reset} className="mt-2">Retry</Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function BillingPage() {
  const fetchProducts = useServerFn(listProducts);
  const fetchSubs = useServerFn(listMySubscriptions);
  const fetchTx = useServerFn(listMyTransactions);

  const products = useQuery({ queryKey: ["billing", "products"], queryFn: () => fetchProducts() });
  const subs = useQuery({ queryKey: ["billing", "subs"], queryFn: () => fetchSubs() });
  const tx = useQuery({ queryKey: ["billing", "tx"], queryFn: () => fetchTx() });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <CreditCard className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Payment structure is scaffolded. Provider (Paddle) will be activated later.
          </p>
        </div>
      </header>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4" />
          <h2 className="font-semibold">Plans</h2>
        </div>
        {products.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (products.data ?? []).length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No plans yet. Admins can add them once the provider is connected.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {products.data!.map((p: any) => (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge variant={p.active ? "default" : "secondary"}>
                    {p.active ? "active" : "inactive"}
                  </Badge>
                </div>
                {p.description ? (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                <p className="text-lg font-bold">
                  {formatMoney(p.price_cents, p.currency)}
                  {p.interval ? <span className="text-sm font-normal">/{p.interval}</span> : null}
                </p>
                <Button className="w-full" disabled>
                  Subscribe (coming soon)
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4" />
          <h2 className="font-semibold">My subscriptions</h2>
        </div>
        <Card className="p-4">
          {subs.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (subs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active subscriptions.</p>
          ) : (
            <ul className="space-y-2">
              {subs.data!.map((s: any) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>{s.hn_payment_products?.name ?? s.provider_subscription_id}</span>
                  <Badge>{s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Transactions</h2>
        <Card className="p-4">
          {tx.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (tx.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {tx.data!.map((t: any) => (
                <li key={t.id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                  <span>{formatMoney(t.amount_cents, t.currency)}</span>
                  <Badge variant="secondary">{t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
