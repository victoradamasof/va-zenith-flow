import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RatingPFFormFields } from "@/components/rating-pf-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createEmptyRatingPFForm,
  type RatingIntake,
  type RatingLinkPayload,
  type RatingPFForm,
} from "@/lib/rating";

export const Route = createFileRoute("/rating-form/$token")({
  component: PublicRatingForm,
  head: () => ({ meta: [{ title: "Ficha de Rating - VA Consultoria" }] }),
});

function PublicRatingForm() {
  const { token } = Route.useParams();
  const [payload, setPayload] = useState<RatingLinkPayload | null>(null);
  const [form, setForm] = useState<RatingPFForm>(createEmptyRatingPFForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPayload() {
      setLoading(true);
      try {
        const response = await fetch(`/api/rating-links/${encodeURIComponent(token)}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Rating link not found: ${response.status}`);
        const data = (await response.json()) as { payload?: RatingLinkPayload; intake?: RatingIntake };
        if (cancelled) return;
        const nextPayload = data.payload ?? null;
        setPayload(nextPayload);
        setForm(
          data.intake?.data ??
            createEmptyRatingPFForm({
              email: nextPayload?.clientEmail ?? "",
              mobilePhone: nextPayload?.clientPhone ?? "",
            }),
        );
        setSubmitted(data.intake?.status === "preenchido");
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPayload();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const missingRequired = useMemo(
    () =>
      [
        form.voterTitle,
        form.rg,
        form.birthDate,
        form.maritalStatus,
        form.homePhone,
        form.fatherName,
        form.motherName,
        form.profession,
        form.admissionDate,
        form.incomeRange,
        form.salary,
        form.familyIncome,
        form.serasaScore,
        form.cep,
        form.street,
        form.number,
        form.district,
        form.city,
        form.uf,
      ].some((item) => !String(item ?? "").trim()),
    [form],
  );

  const submit = async () => {
    if (!payload) return;
    if (missingRequired) {
      toast.error("Preencha os campos obrigatórios antes de enviar.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/rating-intakes/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: form }),
      });
      if (!response.ok) throw new Error(`Rating intake failed: ${response.status}`);
      setSubmitted(true);
      toast.success("Ficha de rating enviada para a VA Consultoria.");
    } catch {
      toast.error("Não foi possível enviar a ficha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <RatingShell>
        <Card className="mx-auto max-w-xl border-primary/25 bg-card/85 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Carregando ficha de Rating</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos abrindo seu link seguro da VA Consultoria.
          </p>
        </Card>
      </RatingShell>
    );
  }

  if (!payload) {
    return (
      <RatingShell>
        <Card className="mx-auto max-w-xl border-destructive/25 bg-card/85 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de Rating não foi encontrado. Solicite um novo link para a equipe VA.
          </p>
        </Card>
      </RatingShell>
    );
  }

  return (
    <RatingShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-primary/20 bg-card/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ficha segura de Rating Pessoa Física
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold">Olá, {payload.clientName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Preencha os dados abaixo para a equipe VA Consultoria realizar a análise de Rating
                Bancário. Seus dados ficam vinculados ao seu atendimento.
              </p>
            </div>
            <img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" className="h-16 w-44 object-contain" />
          </div>
        </Card>

        {submitted && (
          <Card className="border-success/30 bg-success/10 p-4 text-success">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Ficha enviada. Você ainda pode revisar e reenviar se precisar corrigir algo.</p>
            </div>
          </Card>
        )}

        <RatingPFFormFields value={form} onChange={setForm} />

        <Card className="sticky bottom-4 z-10 border-primary/25 bg-card/95 p-4 shadow-glow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Revise as informações antes de enviar. Campos com * são obrigatórios.
            </p>
            <Button
              type="button"
              className="gradient-primary text-primary-foreground"
              onClick={submit}
              disabled={saving}
            >
              <FileText className="mr-2 h-4 w-4" />
              {saving ? "Enviando..." : submitted ? "Reenviar ficha" : "Enviar ficha"}
            </Button>
          </div>
        </Card>
      </div>
    </RatingShell>
  );
}

function RatingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(24_100%_57%/0.18),transparent_34%),radial-gradient(circle_at_80%_20%,hsl(24_100%_57%/0.08),transparent_30%)]" />
      <div className="relative z-10 px-4 py-6 sm:px-8">{children}</div>
    </main>
  );
}
