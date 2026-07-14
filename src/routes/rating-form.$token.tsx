import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RatingPFFormFields } from "@/components/rating-pf-form";
import { RatingPJFormFields } from "@/components/rating-pj-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createEmptyRatingForm,
  createEmptyRatingPFForm,
  getRatingEntityTypeLabel,
  normalizeRatingEntityType,
  normalizeRatingStatus,
  type RatingEntityType,
  type RatingFormData,
  type RatingIntake,
  type RatingLinkPayload,
  type RatingPFForm,
  type RatingPJForm,
} from "@/lib/rating";

export const Route = createFileRoute("/rating-form/$token")({
  component: PublicRatingForm,
  head: () => ({ meta: [{ title: "Ficha de Rating - VA Consultoria" }] }),
});

function PublicRatingForm() {
  const { token } = Route.useParams();
  const [payload, setPayload] = useState<RatingLinkPayload | null>(null);
  const [formType, setFormType] = useState<RatingEntityType>("pf");
  const [form, setForm] = useState<RatingFormData>(createEmptyRatingPFForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const didHydrateRef = useRef(false);
  const lastSavedPayloadRef = useRef("");

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
        const nextType = normalizeRatingEntityType(data.intake?.type ?? nextPayload?.type);
        setPayload(nextPayload);
        setFormType(nextType);
        const nextForm =
          data.intake?.data ??
          createInitialRatingForm(nextType, nextPayload);
        setForm(nextForm);
        lastSavedPayloadRef.current = JSON.stringify(nextForm);
        didHydrateRef.current = true;
        const status = normalizeRatingStatus(data.intake?.status);
        setSubmitted(status === "enviado" || status === "concluido");
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

  useEffect(() => {
    if (!payload || loading || submitted || !didHydrateRef.current) return;

    const serialized = JSON.stringify(form);
    if (serialized === lastSavedPayloadRef.current) return;

    const timeout = window.setTimeout(async () => {
      setAutosaveState("saving");
      try {
        const response = await fetch(`/api/rating-intakes/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: form, status: "pendente" }),
        });
        if (!response.ok) throw new Error(`Rating autosave failed: ${response.status}`);
        lastSavedPayloadRef.current = serialized;
        setAutosaveState("saved");
      } catch {
        setAutosaveState("error");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [form, loading, payload, submitted, token]);

  const missingRequired = useMemo(
    () => isMissingRequired(formType, form),
    [form, formType],
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
        body: JSON.stringify({ data: form, status: "enviado" }),
      });
      if (!response.ok) throw new Error(`Rating intake failed: ${response.status}`);
      lastSavedPayloadRef.current = JSON.stringify(form);
      setAutosaveState("saved");
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
        <Card className="border-primary/20 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ficha segura de Rating {getRatingEntityTypeLabel(formType)}
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold">Olá, {payload.clientName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Preencha os dados abaixo para a equipe VA Consultoria realizar a análise de Rating
                Bancário. Seus dados ficam vinculados ao seu atendimento.
              </p>
            </div>
            <img src="/va-consultoria-logo-cropped.png" alt="VA Consultoria" className="h-14 w-36 object-contain sm:h-16 sm:w-44" />
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

        {formType === "pj" ? (
          <RatingPJFormFields
            value={form as RatingPJForm}
            onChange={(nextForm) => setForm(nextForm)}
            uploadToken={token}
          />
        ) : (
          <RatingPFFormFields
            value={form as RatingPFForm}
            onChange={(nextForm) => setForm(nextForm)}
            uploadToken={token}
          />
        )}

        <Card className="z-10 border-primary/25 bg-card p-4 shadow-sm sm:sticky sm:bottom-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {autosaveState === "saving"
                ? "Salvando rascunho automaticamente..."
                : autosaveState === "saved"
                  ? "Rascunho salvo automaticamente. Campos com * são obrigatórios."
                  : autosaveState === "error"
                    ? "Não foi possível salvar o rascunho agora. Você ainda pode enviar a ficha."
                    : "Revise as informações antes de enviar. Campos com * são obrigatórios."}
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

function createInitialRatingForm(type: RatingEntityType, payload: RatingLinkPayload | null) {
  return createEmptyRatingForm(
    type,
    type === "pj"
      ? {
          contactEmail: payload?.clientEmail ?? "",
          companyPhone: payload?.clientPhone ?? "",
          responsiblePhone: payload?.clientPhone ?? "",
        }
      : {
          email: payload?.clientEmail ?? "",
          mobilePhone: payload?.clientPhone ?? "",
        },
  );
}

function isMissingRequired(type: RatingEntityType, form: RatingFormData) {
  if (type === "pj") {
    const pj = form as RatingPJForm;
    return [
      pj.tradeName,
      pj.stateRegistration,
      pj.municipalRegistration,
      pj.cnae,
      pj.taxRegime,
      pj.responsibleName,
      pj.responsibleRg,
      pj.responsibleCpf,
      pj.responsibleRole,
      pj.responsiblePhone,
      pj.responsibleEmail,
      pj.cep,
      pj.street,
      pj.number,
      pj.district,
      pj.city,
      pj.uf,
      pj.monthlyRevenue,
      pj.annualRevenue,
      pj.serasaScore,
    ].some((item) => !String(item ?? "").trim());
  }

  const pf = form as RatingPFForm;
  return [
    pf.voterTitle,
    pf.rg,
    pf.birthDate,
    pf.maritalStatus,
    pf.homePhone,
    pf.fatherName,
    pf.motherName,
    pf.profession,
    pf.admissionDate,
    pf.incomeRange,
    pf.salary,
    pf.familyIncome,
    pf.serasaScore,
    pf.cep,
    pf.street,
    pf.number,
    pf.district,
    pf.city,
    pf.uf,
  ].some((item) => !String(item ?? "").trim());
}

function RatingShell({ children }: { children: ReactNode }) {
  return (
    <main className="public-rating-page min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,hsl(24_100%_96%),hsl(0_0%_100%)_42%,hsl(24_70%_97%))] text-foreground">
      <div className="relative z-10 px-4 py-5 sm:px-8 sm:py-6">{children}</div>
    </main>
  );
}
