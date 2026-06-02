import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { OptionSelectField } from "@/components/option-select-field";
import { KpiCard } from "@/components/kpi-card";
import { CollaboratorAvatar } from "@/components/collaborator-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumActionButton } from "@/components/ui/premium-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Camera,
  DollarSign,
  Medal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
  UserPlus,
} from "lucide-react";
import { formatBRL, sales as initialSales, sellers as initialSellers } from "@/lib/mock-data";
import { collaboratorInitials } from "@/lib/collaborators";
import { filterSaleReceivables } from "@/lib/data-sync";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useSyncedReceivables } from "@/hooks/use-synced-receivables";

export const Route = createFileRoute("/_app/ranking")({
  component: Ranking,
  head: () => ({ meta: [{ title: "Ranking Comercial - VA" }] }),
});

type Sale = (typeof initialSales)[number];
type Seller = (typeof initialSellers)[number] & {
  role?: string;
  photoUrl?: string;
};

type RankingSeller = Seller & {
  salesCount: number;
  paidSales: number;
  revenue: number;
  received: number;
  pending: number;
  averageTicket: number;
  conversion: number;
  position: number;
};

const emptyForm = {
  id: "",
  name: "",
  role: "Comercial",
  photoUrl: "",
};

const sellerRoleOptions = ["Comercial", "Financeiro", "Operacional", "Administrativo"];

function Ranking() {
  const [sales] = usePersistentState<Sale[]>("va-manager:sales", initialSales);
  const [receivables] = useSyncedReceivables({ sales });
  const [sellers, setSellers] = usePersistentState<Seller[]>(
    "va-manager:collaborators",
    initialSellers,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const ranking = useMemo(() => {
    const saleReceivables = filterSaleReceivables(receivables, sales);
    const rows = sellers
      .filter((seller) => seller.name.trim())
      .map((seller) => {
        const sellerSales = sales.filter((sale) => sale.seller === seller.name);
        const revenue = sellerSales.reduce((sum, sale) => sum + sale.value, 0);
        const received = saleReceivables
          .filter((item) => item.seller === seller.name && item.status === "recebido")
          .reduce((sum, item) => sum + item.amount, 0);
        const pending = saleReceivables
          .filter((item) => item.seller === seller.name && item.status === "previsto")
          .reduce((sum, item) => sum + item.amount, 0);
        const paidSales = sellerSales.filter((sale) => sale.status === "pago").length;

        return {
          ...seller,
          avatar: seller.avatar || collaboratorInitials(seller.name),
          salesCount: sellerSales.length,
          paidSales,
          revenue,
          received,
          pending,
          averageTicket: sellerSales.length ? Math.round(revenue / sellerSales.length) : 0,
          conversion: sellerSales.length ? Math.round((paidSales / sellerSales.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount);

    return rows.map((row, index) => ({ ...row, position: index + 1 }));
  }, [receivables, sales, sellers]);

  const filteredRanking = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return ranking;
    return ranking.filter((seller) =>
      [seller.name, seller.role ?? "", String(seller.salesCount), String(seller.revenue)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, ranking]);

  const performanceRanking = ranking.filter(
    (seller) =>
      seller.salesCount > 0 || seller.revenue > 0 || seller.received > 0 || seller.pending > 0,
  );
  const podium = performanceRanking.slice(0, 3);
  const champion = performanceRanking[0];
  const totalRevenue = ranking.reduce((sum, seller) => sum + seller.revenue, 0);
  const totalSales = ranking.reduce((sum, seller) => sum + seller.salesCount, 0);
  const bestTicket = Math.max(0, ...ranking.map((seller) => seller.averageTicket));

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (seller: Seller) => {
    setForm({
      id: seller.id,
      name: seller.name,
      role: seller.role ?? "Comercial",
      photoUrl: seller.photoUrl ?? "",
    });
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setForm(emptyForm);
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => updateForm("photoUrl", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const submitSeller = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    const seller: Seller = {
      id: form.id || `seller-${Date.now()}`,
      name,
      avatar: collaboratorInitials(name),
      role: form.role.trim() || "Comercial",
      photoUrl: form.photoUrl,
      sales: 0,
      revenue: 0,
    };

    setSellers((current) =>
      form.id ? current.map((item) => (item.id === form.id ? seller : item)) : [seller, ...current],
    );
    closeDialog();
    toast.success(form.id ? "Vendedor atualizado." : "Vendedor adicionado.");
  };

  const removeSeller = (id: string) => {
    setSellers((current) => current.filter((seller) => seller.id !== id));
    toast.success("Vendedor removido do ranking.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ranking Comercial"
        subtitle="Pódio de vendedores integrado às vendas cadastradas"
        action={
          <Dialog
            open={open}
            onOpenChange={(value) => {
              if (value) {
                setOpen(true);
              } else {
                closeDialog();
              }
            }}
          >
            <DialogTrigger asChild>
              <PremiumActionButton
                icon={<Plus />}
                title="Novo vendedor"
                subtitle="Cadastrar ranking"
                size="sm"
                onClick={openCreate}
              />
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <form onSubmit={submitSeller}>
                <DialogHeader>
                  <DialogTitle>{form.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
                  <DialogDescription>
                    A foto e o nome aparecem no podio. As vendas sao calculadas pela aba Vendas.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-5 grid gap-4 md:grid-cols-[140px_1fr]">
                  <div className="space-y-3">
                    <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-border/60 bg-secondary">
                      {form.photoUrl ? (
                        <img
                          src={form.photoUrl}
                          alt={form.name || "Vendedor"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs hover:border-primary hover:text-primary">
                      <Camera className="h-3.5 w-3.5" />
                      Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhoto}
                      />
                    </Label>
                  </div>
                  <div className="grid content-start gap-4">
                    <RankingField
                      label="Nome"
                      value={form.name}
                      onChange={(value) => updateForm("name", value)}
                      required
                    />
                    <OptionSelectField
                      label="Função"
                      value={form.role}
                      onChange={(value) => updateForm("role", value)}
                      options={sellerRoleOptions}
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary text-primary-foreground">
                    Salvar vendedor
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Vendedores"
          value={String(sellers.length)}
          icon={UserPlus}
          accent="primary"
        />
        <KpiCard
          label="Vendas rankeadas"
          value={String(totalSales)}
          icon={Trophy}
          accent="success"
        />
        <KpiCard
          label="Receita do time"
          value={formatBRL(totalRevenue)}
          icon={DollarSign}
          accent="success"
        />
        <KpiCard
          label="Melhor ticket medio"
          value={formatBRL(bestTicket)}
          icon={Medal}
          accent="info"
        />
      </div>

      <Card className="overflow-hidden border-border/60 bg-card/60">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/15 via-card to-success/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">Pódio comercial</h3>
              <p className="text-sm text-muted-foreground">
                Ranking atualizado automaticamente com as vendas registradas.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Campeao: {champion?.name ?? "Sem vendas"}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-end">
          <PodiumSeller seller={podium[1]} place={2} heightClass="min-h-[220px]" />
          <PodiumSeller seller={podium[0]} place={1} heightClass="min-h-[280px]" featured />
          <PodiumSeller seller={podium[2]} place={3} heightClass="min-h-[200px]" />
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Vendedores e desempenho</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar vendedor..."
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Posição</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRanking.map((seller) => (
                <TableRow key={seller.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Badge variant="outline" className="border-border/60">
                      #{seller.position}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CollaboratorAvatar person={seller} className="h-9 w-9 text-sm" />
                      <span className="font-medium">{seller.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {seller.role ?? "Comercial"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{seller.salesCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatBRL(seller.revenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-success">
                    {formatBRL(seller.received)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-info">
                    {formatBRL(seller.pending)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(seller.averageTicket)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(seller)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeSeller(seller.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRanking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum vendedor encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function RankingField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function PodiumSeller({
  seller,
  place,
  heightClass,
  featured = false,
}: {
  seller?: RankingSeller;
  place: 1 | 2 | 3;
  heightClass: string;
  featured?: boolean;
}) {
  const placeStyle = {
    1: "from-primary/45 to-primary/10 border-primary/45",
    2: "from-muted/70 to-muted/20 border-border",
    3: "from-warning/30 to-warning/10 border-warning/35",
  }[place];

  return (
    <div
      className={`relative flex flex-col items-center justify-end rounded-lg border bg-gradient-to-b p-4 text-center ${placeStyle} ${heightClass}`}
    >
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-background/80 font-display text-sm font-bold">
          {place}
        </div>
        {featured && <Trophy className="h-5 w-5 text-primary" />}
      </div>
      <CollaboratorAvatar
        person={seller}
        className={featured ? "h-24 w-24 text-xl" : "h-20 w-20 text-lg"}
      />
      <h4 className="mt-4 font-display text-lg font-semibold">{seller?.name ?? "Sem vendedor"}</h4>
      <p className="text-xs text-muted-foreground">{seller?.role ?? "Comercial"}</p>
      <div className="mt-4 grid w-full grid-cols-2 gap-2 rounded-md bg-background/45 p-3 text-xs">
        <span className="text-muted-foreground">Vendas</span>
        <span className="text-right font-medium">{seller?.salesCount ?? 0}</span>
        <span className="text-muted-foreground">Receita</span>
        <span className="text-right font-medium">{formatBRL(seller?.revenue ?? 0)}</span>
        <span className="text-muted-foreground">Recebido</span>
        <span className="text-right font-medium text-success">
          {formatBRL(seller?.received ?? 0)}
        </span>
      </div>
    </div>
  );
}
