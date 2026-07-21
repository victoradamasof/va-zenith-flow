import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileText, Link2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RatingPFFormFields } from "@/components/rating-pf-form";
import { RatingPJFormFields } from "@/components/rating-pj-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  clients as initialClients,
  sales as initialSales,
  formatBRL,
} from "@/lib/mock-data";
import {
  createEmptyRatingForm,
  getRatingFormSnapshot,
  getRatingEntityTypeLabel,
  getRatingStatusLabel,
  inferRatingEntityType,
  isRatingService,
  mergeRatingIntakes,
  normalizeRatingEntityType,
  normalizeRatingStatus,
  ratingIntakesKey,
  ratingLinksKey,
  ratingStatusOptions,
  saveRatingFormSnapshot,
  type RatingEntityType,
  type RatingFormData,
  type RatingIntake,
  type RatingIntakeStatus,
  type RatingLinkPayload,
  type RatingLinkRecord,
  type RatingPFForm,
  type RatingPJForm,
} from "@/lib/rating";
import { formatLocalDateBR } from "@/lib/date-utils";

export const Route = createFileRoute("/_app/rating")({
  component: Rating,
  head: () => ({ meta: [{ title: "Rating - VA Consultoria" }] }),
});

type Sale = (typeof initialSales)[number] & {
  paymentMethod?: string;
  status?: string;
};

type Client = (typeof initialClients)[number] & {
  seller?: string;
  address?: string;
  doc?: string;
};

function Rating() {
  const [sales] = usePersistentState<Sale[]>("va-manager:sales", initialSales);
  const [clients] = usePersistentState<Client[]>("va-manager:clients", initialClients);
  const [intakes, setIntakes] = usePersistentState<RatingIntake[]>(ratingIntakesKey, []);
  const [links, setLinks] = usePersistentState<RatingLinkRecord[]>(ratingLinksKey, []);
  const [query, setQuery] = useState("");
  const [selectedIntake, setSelectedIntake] = useState<RatingIntake | null>(null);
  const [selectedForm, setSelectedForm] = useState<RatingFormData>(createEmptyRatingForm("pf"));

  useEffect(() => {
    let cancelled = false;

    async function loadCloudIntakes() {
      try {
        const response = await fetch("/api/rating-intakes", {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: RatingIntake[] };
        if (!cancelled && Array.isArray(data.records)) {
          setIntakes((current) => mergeRatingIntakes(current, data.records ?? []));
        }
      } catch (error) {
        console.warn("Could not load rating intakes", error);
      }
    }

    void loadCloudIntakes();
    const interval = window.setInterval(loadCloudIntakes, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setIntakes]);

  const ratingSales = useMemo(
    () => sales.filter((sale) => isRatingService(sale.service)),
    [sales],
  );

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ratingSales
      .map((sale) => {
        const client = clients.find(
          (item) => item.name.trim().toLowerCase() === sale.client.trim().toLowerCase(),
        );
        // A ficha pertence a uma venda, não ao nome do cliente. O mesmo cliente
        // pode contratar Rating PF e PJ em vendas diferentes.
        const intake = intakes.find((item) => item.saleId === sale.id);
        const link = links.find((item) => item.saleId === sale.id);
        const ratingType = normalizeRatingEntityType(
          intake?.type ?? link?.type ?? inferRatingEntityType(client?.doc ?? ""),
        );

        return { sale, client, intake, link, ratingType };
      })
      .filter(({ sale, client, intake }) => {
        if (!normalizedQuery) return true;
        return [sale.client, sale.seller, sale.service, client?.email, intake?.status]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [clients, intakes, links, query, ratingSales]);

  const pending = rows.filter((row) => normalizeRatingStatus(row.intake?.status) === "pendente").length;
  const sent = rows.filter((row) => normalizeRatingStatus(row.intake?.status) === "enviado").length;
  const completed = rows.filter((row) => normalizeRatingStatus(row.intake?.status) === "concluido").length;
  const ratingRevenue = rows.reduce((sum, row) => sum + Number(row.sale.value ?? 0), 0);

  const openIntake = (saleId: string) => {
    const row = rows.find((item) => item.sale.id === saleId);
    if (!row) return;

    const intake =
      row.intake ??
      {
        ...createPendingIntake({
        saleId: row.sale.id,
        clientName: row.sale.client,
        clientEmail: row.client?.email,
        clientPhone: row.client?.phone,
        service: row.sale.service,
        seller: row.sale.seller,
        type: row.ratingType,
        }),
        token: row.link?.token ?? "",
      };

    setSelectedIntake(intake);
    setSelectedForm(getRatingFormSnapshot(intake, normalizeRatingEntityType(intake.type)));
  };

  const saveInternalIntake = () => {
    if (!selectedIntake) return;
    const status = normalizeRatingStatus(selectedIntake.status);
    const nextRecord = saveRatingFormSnapshot({
      ...selectedIntake,
      status,
      submittedAt: status === "pendente" ? selectedIntake.submittedAt : selectedIntake.submittedAt ?? new Date().toISOString(),
    }, normalizeRatingEntityType(selectedIntake.type), selectedForm);
    setIntakes((current) => mergeRatingIntakes(current, [nextRecord]));
    setSelectedIntake(nextRecord);
    if (nextRecord.token) {
      void saveIntakeToServer(nextRecord);
    }
    toast.success("Ficha de rating atualizada.");
  };

  const updateRatingStatus = (saleId: string, nextStatus: RatingIntakeStatus) => {
    const row = rows.find((item) => item.sale.id === saleId);
    if (!row) return;

    const baseRecord =
      row.intake ??
      {
        ...createPendingIntake({
          saleId: row.sale.id,
          clientName: row.sale.client,
          clientEmail: row.client?.email,
          clientPhone: row.client?.phone,
          service: row.sale.service,
          seller: row.sale.seller,
          type: row.ratingType,
        }),
        token: row.link?.token ?? "",
      };

    const nextRecord: RatingIntake = {
      ...baseRecord,
      status: nextStatus,
      submittedAt: nextStatus === "pendente" ? baseRecord.submittedAt : baseRecord.submittedAt ?? new Date().toISOString(),
    };

    setIntakes((current) => mergeRatingIntakes(current, [nextRecord]));
    if (selectedIntake?.saleId === saleId) {
      setSelectedIntake(nextRecord);
    }
    if (nextRecord.token) {
      void saveIntakeToServer(nextRecord);
    }
    toast.success(`Status alterado para ${getRatingStatusLabel(nextStatus)}.`);
  };

  const updateRatingType = async (saleId: string, nextType: RatingEntityType) => {
    const row = rows.find((item) => item.sale.id === saleId);
    if (!row) return;

    const currentType = normalizeRatingEntityType(row.intake?.type ?? row.link?.type ?? row.ratingType);
    const baseRecord =
      row.intake ??
      {
        ...createPendingIntake({
          saleId: row.sale.id,
          clientName: row.sale.client,
          clientEmail: row.client?.email,
          clientPhone: row.client?.phone,
          service: row.sale.service,
          seller: row.sale.seller,
          type: currentType,
        }),
        token: row.link?.token ?? "",
      };

    const recordWithCurrentSnapshot = saveRatingFormSnapshot(
      baseRecord,
      currentType,
      baseRecord.data,
    );
    const nextData = getRatingFormSnapshot(recordWithCurrentSnapshot, nextType);
    const nextRecord = saveRatingFormSnapshot({
      ...recordWithCurrentSnapshot,
      type: nextType,
    }, nextType, nextData);

    setIntakes((current) => mergeRatingIntakes(current, [nextRecord]));
    if (selectedIntake?.saleId === saleId) {
      setSelectedIntake(nextRecord);
      setSelectedForm(nextRecord.data);
    }
    if (row.link) {
      setLinks((current) =>
        current.map((item) =>
          item.saleId === saleId ? { ...item, type: nextType } : item,
        ),
      );
    }
    if (nextRecord.token) {
      try {
        await updateRatingLinkType(nextRecord.token, nextType);
        const saved = await saveIntakeToServer(nextRecord);
        if (!saved) throw new Error("Rating intake sync failed");
      } catch (error) {
        console.warn("Could not sync rating type", error);
        toast.error("O tipo foi alterado neste dispositivo, mas ainda não sincronizou com a nuvem.");
        return;
      }
    }
    toast.success(`Ficha alterada para ${getRatingEntityTypeLabel(nextType)}.`);
  };

  const generateLink = async (saleId: string) => {
    const row = rows.find((item) => item.sale.id === saleId);
    if (!row) return;

    const existing = row.link;
    if (existing && normalizeRatingEntityType(existing.type) === row.ratingType) {
      await copyLink(buildAbsoluteUrl(existing.path));
      return;
    }

    const payload: RatingLinkPayload = {
      saleId: row.sale.id,
      clientName: row.sale.client,
      clientEmail: row.client?.email,
      clientPhone: row.client?.phone,
      service: row.sale.service,
      seller: row.sale.seller,
      type: row.ratingType,
    };

    try {
      const response = await fetch("/api/rating-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload,
          slugBase: `rating-${row.sale.client}`,
        }),
      });
      if (!response.ok) throw new Error(`Rating link failed: ${response.status}`);
      const data = (await response.json()) as { token: string; path: string };
      const record: RatingLinkRecord = {
        token: data.token,
        saleId: row.sale.id,
        clientName: row.sale.client,
        service: row.sale.service,
        seller: row.sale.seller,
        type: row.ratingType,
        path: data.path,
        createdAt: new Date().toISOString(),
      };
      setLinks((current) => [record, ...current.filter((item) => item.saleId !== row.sale.id)]);
      await copyLink(buildAbsoluteUrl(data.path));
    } catch {
      toast.error("Não foi possível gerar o link de rating.");
    }
  };

  const copyExistingLink = async (path?: string) => {
    if (!path) return;
    await copyLink(buildAbsoluteUrl(path));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rating"
        subtitle="Fichas de Rating Pessoa Física e Pessoa Jurídica integradas às vendas e clientes"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vendas de rating
          </p>
          <p className="mt-3 font-display text-3xl font-semibold">{rows.length}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pendentes
          </p>
          <p className="mt-3 font-display text-3xl font-semibold">{pending}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Enviados
          </p>
          <p className="mt-3 font-display text-3xl font-semibold">{sent}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Concluídos
          </p>
          <p className="mt-3 font-display text-3xl font-semibold">{completed}</p>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">Clientes com Rating Bancário</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {pending} pendentes · {sent} enviados · {completed} concluídos · {formatBRL(ratingRevenue)}
            </p>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente, vendedor ou serviço..."
            className="h-9 w-full md:w-80"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ sale, client, intake, link, ratingType }) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium transition hover:text-primary"
                      onClick={() => openIntake(sale.id)}
                    >
                      {sale.client}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {client?.email ?? "sem e-mail"} · {client?.phone ?? "sem telefone"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ratingType}
                      onValueChange={(value) => void updateRatingType(sale.id, value as RatingEntityType)}
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pf">PF</SelectItem>
                        <SelectItem value="pj">PJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{sale.service}</TableCell>
                  <TableCell>{sale.seller}</TableCell>
                  <TableCell>
                    <p>{formatLocalDateBR(sale.date)}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(Number(sale.value ?? 0))}</p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={normalizeRatingStatus(intake?.status)}
                      onValueChange={(value) => updateRatingStatus(sale.id, value as RatingIntakeStatus)}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ratingStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                    {link ? buildAbsoluteUrl(link.path) : "Não gerado"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => generateLink(sale.id)}>
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        {link ? "Copiar" : "Gerar link"}
                      </Button>
                      {link && (
                        <Button variant="ghost" size="sm" onClick={() => copyExistingLink(link.path)}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copiar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma venda de Rating Bancário encontrada. Cadastre uma venda com serviço de
                    rating para ela aparecer aqui.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={Boolean(selectedIntake)} onOpenChange={(open) => !open && setSelectedIntake(null)}>
        <DialogContent className="max-h-[92vh] max-w-[96vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ficha de Rating {getRatingEntityTypeLabel(selectedIntake?.type)} - {selectedIntake?.clientName}
            </DialogTitle>
            <DialogDescription>
              Dados enviados pelo cliente ou preenchidos internamente pela equipe comercial.
            </DialogDescription>
          </DialogHeader>
          {selectedIntake ? (
            <Card className="border-border/60 bg-muted/25 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px] sm:items-center">
                <div>
                  <p className="text-sm font-semibold">Status da ficha</p>
                  <p className="text-xs text-muted-foreground">
                    Use Pendente para rascunhos, Enviado quando o cliente terminar e Concluído após análise.
                  </p>
                </div>
                <Select
                  value={normalizeRatingStatus(selectedIntake.status)}
                  onValueChange={(value) =>
                    setSelectedIntake((current) =>
                      current ? { ...current, status: value as RatingIntakeStatus } : current,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ) : null}
          {normalizeRatingEntityType(selectedIntake?.type) === "pj" ? (
            <RatingPJFormFields
              value={selectedForm as RatingPJForm}
              onChange={(nextForm) => setSelectedForm(nextForm)}
              uploadToken={selectedIntake?.token}
              showFileActions
            />
          ) : (
            <RatingPFFormFields
              value={selectedForm as RatingPFForm}
              onChange={(nextForm) => setSelectedForm(nextForm)}
              uploadToken={selectedIntake?.token}
              showFileActions
            />
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSelectedIntake(null)}>
              Fechar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedForm(createEmptyRatingForm(normalizeRatingEntityType(selectedIntake?.type)))}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar ficha
            </Button>
            <Button type="button" className="gradient-primary text-primary-foreground" onClick={saveInternalIntake}>
              <FileText className="mr-2 h-4 w-4" />
              Salvar ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function createPendingIntake(payload: RatingLinkPayload): RatingIntake {
  const type = normalizeRatingEntityType(payload.type);
  return {
    id: `rating-${payload.saleId}`,
    token: "",
    saleId: payload.saleId,
    clientName: payload.clientName,
    clientEmail: payload.clientEmail,
    clientPhone: payload.clientPhone,
    service: payload.service,
    seller: payload.seller,
    type,
    status: "pendente",
    createdAt: new Date().toISOString(),
    data: createEmptyRatingForm(
      type,
      type === "pj"
        ? {
            contactEmail: payload.clientEmail ?? "",
            companyPhone: payload.clientPhone ?? "",
            responsiblePhone: payload.clientPhone ?? "",
          }
        : {
            email: payload.clientEmail ?? "",
            mobilePhone: payload.clientPhone ?? "",
          },
    ),
  };
}

async function copyLink(url: string) {
  await navigator.clipboard.writeText(url);
  toast.success("Link de Rating copiado.");
}

function buildAbsoluteUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${window.location.origin}${path}`;
}

async function saveIntakeToServer(record: RatingIntake) {
  if (!record.token) return false;

  try {
    const response = await fetch(`/api/rating-intakes/${encodeURIComponent(record.token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: record.data,
        forms: record.forms,
        status: normalizeRatingStatus(record.status),
      }),
    });
    if (!response.ok) throw new Error(`Rating intake sync failed: ${response.status}`);
    return true;
  } catch (error) {
    console.warn("Could not sync rating intake status", error);
    return false;
  }
}

async function updateRatingLinkType(token: string, type: RatingEntityType) {
  const response = await fetch(`/api/rating-links/${encodeURIComponent(token)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type }),
  });
  if (!response.ok) throw new Error(`Rating link type sync failed: ${response.status}`);
}
