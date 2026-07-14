import { useRef, useState, type ChangeEvent } from "react";
import { Download, Eye, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import type { RatingFileInfo } from "@/lib/rating";

type RatingDocumentFileProps = {
  label: string;
  file?: RatingFileInfo;
  onUpload: (file: File) => Promise<void>;
  readOnly?: boolean;
  token?: string;
  showFileActions?: boolean;
};

export function RatingDocumentFile({
  label,
  file,
  onUpload,
  readOnly = false,
  token,
  showFileActions = false,
}: RatingDocumentFileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setUploading(true);
    try {
      await onUpload(selected);
      toast.success("Documento enviado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o documento.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="min-w-56 font-medium">{label}</span>
      {!readOnly && (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:cursor-wait disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Enviando..." : file ? "Substituir" : "Fazer upload"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={handleChange}
          />
        </>
      )}
      <span className="min-w-0 break-all text-muted-foreground">{file?.name ?? "Nenhum arquivo"}</span>
      <RatingFileActions file={file} token={token} show={showFileActions} />
    </div>
  );
}

export function RatingFileActions({
  file,
  token,
  show,
}: {
  file?: RatingFileInfo;
  token?: string;
  show?: boolean;
}) {
  if (!show || !file) return null;
  if (!file.id || !token) {
    return <span className="text-xs text-amber-600">Reenvie este arquivo para habilitar o download.</span>;
  }

  const baseUrl = `/api/rating-files/${encodeURIComponent(file.id)}?token=${encodeURIComponent(token)}`;
  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={baseUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={`Visualizar ${file.name}`}
      >
        <Eye className="h-3.5 w-3.5" /> Visualizar
      </a>
      <a
        href={`${baseUrl}&download=1`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        download={file.name}
        title={`Baixar ${file.name}`}
      >
        <Download className="h-3.5 w-3.5" /> Baixar
      </a>
    </span>
  );
}
