import { createFileRoute } from "@tanstack/react-router";
import { Camera, CheckCircle2, Download, FileSignature, Printer, RotateCcw } from "lucide-react";
import {
  Dispatch,
  PointerEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildFullPrintableHtml,
  decodeSigningPayload,
  type ContractPrintEvidence,
  type ContractSignatureEvidence,
  type ContractSignatureRole,
  type ContractSigningPayload,
  type SignedContractRecord,
} from "@/routes/_app/contracts";
import { usePersistentState } from "@/hooks/use-persistent-state";

export const Route = createFileRoute("/sign/$token")({
  component: DigitalSignaturePage,
  head: () => ({ meta: [{ title: "Assinatura Digital - VA Consultoria" }] }),
});

function DigitalSignaturePage() {
  const { token } = Route.useParams();
  const decodedPayload = useMemo(() => decodeSigningPayload(token), [token]);
  const [signingPayload, setSigningPayload] = useState<ContractSigningPayload | null>(
    decodedPayload,
  );
  const [loadingPayload, setLoadingPayload] = useState(!decodedPayload);
  const [signedContracts, setSignedContracts] = usePersistentState<SignedContractRecord[]>(
    "va-manager:signed-contracts",
    [],
  );
  const [selfie, setSelfie] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signedAt, setSignedAt] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (decodedPayload) {
      setSigningPayload(decodedPayload);
      setLoadingPayload(false);
      return;
    }

    let cancelled = false;

    async function loadShortLinkPayload() {
      setLoadingPayload(true);
      try {
        const response = await fetch(`/api/signing-links/${encodeURIComponent(token)}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Signing link not found: ${response.status}`);
        const data = (await response.json()) as {
          payload?: ContractSigningPayload;
        };
        if (!cancelled) {
          setSigningPayload(data.payload ?? null);
        }
      } catch {
        if (!cancelled) {
          setSigningPayload(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingPayload(false);
        }
      }
    }

    void loadShortLinkPayload();

    return () => {
      cancelled = true;
    };
  }, [decodedPayload, token]);

  useEffect(() => {
    if (!signingPayload) return;

    let cancelled = false;

    async function loadSignedRecord() {
      try {
        const contractId = getContractId(signingPayload as ContractSigningPayload);
        const response = await fetch(`/api/signed-contracts/${encodeURIComponent(contractId)}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const data = (await response.json()) as { record?: SignedContractRecord | null };
        if (!cancelled && data.record) {
          setSignedContracts((current) => mergeSignedContracts(current, [data.record!]));
        }
      } catch (error) {
        console.warn("Could not load signed contract record", error);
      }
    }

    void loadSignedRecord();

    return () => {
      cancelled = true;
    };
  }, [setSignedContracts, signingPayload]);

  if (loadingPayload) {
    return (
      <SignatureShell>
        <Card className="mx-auto max-w-xl border-primary/30 bg-card/80 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Carregando contrato</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos abrindo o link seguro de assinatura.
          </p>
        </Card>
      </SignatureShell>
    );
  }

  const payload = signingPayload;

  if (!payload) {
    return (
      <SignatureShell>
        <Card className="mx-auto max-w-xl border-destructive/30 bg-card/80 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de assinatura não pôde ser lido. Gere um novo link na aba de contratos.
          </p>
        </Card>
      </SignatureShell>
    );
  }

  const signerRole = payload.signerRole ?? "client";
  const signerName =
    signerRole === "seller"
      ? payload.form.seller || "Vendedor responsável"
      : payload.form.clientName || "Contratante";
  const existingRecord = signedContracts.find((contract) => contract.id === getContractId(payload));
  const currentEvidence = getPrintEvidence(existingRecord);
  const contractHtml = buildFullPrintableHtml(payload.form, payload.settings, currentEvidence);
  const finalHtml = existingRecord?.html || "";
  const completed = Boolean(selfie && signature && accepted);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      toast.error("Não foi possível abrir a câmera. Verifique a permissão do navegador.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 720;
    canvas.height = videoRef.current.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setSelfie(canvas.toDataURL("image/jpeg", 0.88));
    stopCamera();
    toast.success("Selfie registrada.");
  };

  const beginDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const context = getSignatureContext(event);
    context?.beginPath();
    draw(event);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = getSignatureContext(event);
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    context.lineTo(x, y);
    context.stroke();
    setSignature(canvas.toDataURL("image/png"));
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  };

  const confirmSignature = async () => {
    if (!completed) {
      toast.error("Registre a selfie, assine e confirme a autorização.");
      return;
    }
    const now = new Date().toISOString();
    setSignedAt(now);
    const record = saveSignedRecord(
      payload,
      signerRole,
      signerName,
      now,
      selfie,
      signature,
      signedContracts,
      setSignedContracts,
    );
    try {
      const savedRecord = await saveSignedRecordToCloud(record);
      if (savedRecord) {
        setSignedContracts((current) => mergeSignedContracts(current, [savedRecord]));
      }
    } catch {
      toast.warning(
        "Assinatura salva neste aparelho. Tente novamente se ela nÃ£o aparecer no painel.",
      );
    }
    toast.success(
      signerRole === "seller"
        ? "Assinatura do vendedor registrada."
        : "Assinatura do contratante registrada.",
    );
  };

  const downloadSignedContract = () => {
    const html = finalHtml || buildCurrentSignedHtml(payload, existingRecord);
    if (!html) {
      toast.error("O contrato só pode ser baixado depois que contratante e vendedor assinarem.");
      return;
    }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contrato-assinado-${slugify(payload.form.clientName || "cliente")}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printSignedContract = () => {
    const html = finalHtml || buildCurrentSignedHtml(payload, existingRecord);
    if (!html) {
      toast.error("O contrato só pode ser impresso depois que contratante e vendedor assinarem.");
      return;
    }
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      toast.error("Permita pop-ups para imprimir o contrato.");
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <SignatureShell>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              VA Consultoria
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
              {signerRole === "seller"
                ? "Assinatura digital do vendedor"
                : "Assinatura digital do contratante"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confira o contrato, registre uma selfie, assine com o dedo ou mouse e confirme sua
              assinatura.
            </p>
          </div>

          <Card className="border-primary/25 bg-card/80 p-5 shadow-[0_0_45px_rgba(255,112,24,0.08)]">
            <h2 className="mb-4 font-display text-lg font-semibold">1. Validação por selfie</h2>
            {selfie ? (
              <div className="space-y-3">
                <img
                  src={selfie}
                  alt="Selfie registrada"
                  className="h-56 w-full rounded-lg border border-border object-cover"
                />
                <Button variant="outline" onClick={() => setSelfie("")}>
                  Refazer selfie
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-56 w-full rounded-lg border border-border bg-black object-cover"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Abrir câmera
                  </Button>
                  <Button onClick={captureSelfie} disabled={!cameraActive}>
                    Tirar selfie
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="border-primary/25 bg-card/80 p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">2. Assinatura na tela</h2>
            <canvas
              ref={canvasRef}
              width={760}
              height={260}
              className="h-52 w-full touch-none rounded-lg border border-border bg-white"
              onPointerDown={beginDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={clearSignature}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Limpar assinatura
              </Button>
              <p className="text-xs text-muted-foreground">
                Assine dentro do campo branco usando mouse, touchpad ou dedo.
              </p>
            </div>
          </Card>

          <Card className="border-primary/25 bg-card/80 p-5">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                Li o contrato, concordo com os termos e confirmo que a selfie e a assinatura foram
                realizadas por mim nesta data como {signerRole === "seller" ? "vendedor responsável" : "contratante"}.
              </span>
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="gradient-primary text-primary-foreground"
                onClick={confirmSignature}
                disabled={!completed}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmar assinatura
              </Button>
              <Button variant="outline" onClick={downloadSignedContract} disabled={!signedAt}>
                <Download className="mr-2 h-4 w-4" />
                Baixar finalizado
              </Button>
              <Button variant="outline" onClick={printSignedContract} disabled={!signedAt}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir / PDF
              </Button>
            </div>
          </Card>
        </div>

        <Card className="border-border/60 bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Prévia do contrato</h2>
              <p className="text-xs text-muted-foreground">
                Cliente: {payload.form.clientName} · Serviço: {payload.form.service}
              </p>
            </div>
            <FileSignature className="h-5 w-5 text-primary" />
          </div>
          <iframe
            title="Prévia do contrato"
            srcDoc={contractHtml}
            className="h-[780px] w-full rounded-lg border border-border bg-white"
          />
        </Card>
      </div>
    </SignatureShell>
  );
}

function SignatureShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,112,24,0.16),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(255,112,24,0.08),transparent_30%)]" />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

function getSignatureContext(event: PointerEvent<HTMLCanvasElement>) {
  const context = event.currentTarget.getContext("2d");
  if (!context) return null;
  context.strokeStyle = "#111";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

function saveSignedRecord(
  payload: ContractSigningPayload,
  role: ContractSignatureRole,
  signerName: string,
  signedAt: string,
  selfie: string,
  signature: string,
  current: SignedContractRecord[],
  setSignedContracts: Dispatch<SetStateAction<SignedContractRecord[]>>,
) {
  const contractId = getContractId(payload);
  const existing = current.find((item) => item.id === contractId);
  const evidence: ContractSignatureEvidence = {
    role,
    name: signerName,
    selfie,
    signature,
    signedAt,
  };
  const mergedEvidence: ContractPrintEvidence = {
    client: role === "client" ? evidence : existing?.clientEvidence,
    seller: role === "seller" ? evidence : existing?.sellerEvidence,
  };
  const html =
    mergedEvidence.client && mergedEvidence.seller
      ? buildFullPrintableHtml(payload.form, payload.settings, mergedEvidence)
      : undefined;
  const record: SignedContractRecord = {
    id: contractId,
    clientName: payload.form.clientName,
    service: payload.form.service,
    seller: payload.form.seller,
    total: parseCurrency(payload.form.tapValue) + parseCurrency(payload.form.feeValue),
    signedAt,
    signerIpNote: "Registro local sem coleta de IP.",
    clientEvidence: mergedEvidence.client,
    sellerEvidence: mergedEvidence.seller,
    html,
  };
  setSignedContracts([record, ...current.filter((item) => item.id !== record.id)].slice(0, 50));
  return record;
}

function mergeSignedContracts(
  current: SignedContractRecord[],
  incoming: SignedContractRecord[],
) {
  const merged = new Map<string, SignedContractRecord>();

  for (const record of current) {
    merged.set(record.id, record);
  }

  for (const record of incoming) {
    const existing = merged.get(record.id);
    merged.set(record.id, {
      ...existing,
      ...record,
      clientEvidence: record.clientEvidence ?? existing?.clientEvidence,
      sellerEvidence: record.sellerEvidence ?? existing?.sellerEvidence,
      html: record.html ?? existing?.html,
    });
  }

  return Array.from(merged.values()).slice(0, 50);
}

async function saveSignedRecordToCloud(record: SignedContractRecord) {
  const response = await fetch("/api/signed-contracts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) throw new Error(`Could not save signed contract: ${response.status}`);
  const data = (await response.json()) as { record?: SignedContractRecord };
  return data.record;
}

function getPrintEvidence(record?: SignedContractRecord): ContractPrintEvidence | undefined {
  if (!record?.clientEvidence && !record?.sellerEvidence) return undefined;
  return {
    client: record.clientEvidence,
    seller: record.sellerEvidence,
  };
}

function buildCurrentSignedHtml(
  payload: ContractSigningPayload,
  record?: SignedContractRecord,
) {
  if (!record?.clientEvidence || !record.sellerEvidence) return "";
  return buildFullPrintableHtml(payload.form, payload.settings, {
    client: record.clientEvidence,
    seller: record.sellerEvidence,
  });
}

function getContractId(payload: ContractSigningPayload) {
  return payload.contractId || `${payload.form.clientName}-${payload.createdAt}`;
}

function parseCurrency(value = "") {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
