import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  dataKeys,
  emptyData,
  exportLocalData,
  replaceLocalData,
  restoreDemoData,
  type DataKey,
} from "@/lib/data-management";
import { formatBrazilianPhone } from "@/lib/br-inputs";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações - VA" }] }),
});

const initialSettings = {
  company: {
    legalName: "VA Consultoria LTDA",
    cnpj: "12.345.678/0001-90",
    email: "contato@vaconsultoria.com",
    phone: "(11) 4002-8922",
  },
  notifications: {
    bills: true,
    daily: true,
    goals: true,
    clients: false,
    insights: true,
  },
  system: {
    currency: "BRL (R$)",
    timezone: "America/Sao_Paulo",
    dateFormat: "DD/MM/YYYY",
  },
};

function SettingsPage() {
  const [settings, setSettings] = usePersistentState("va-manager:settings", initialSettings);
  const importInputRef = useRef<HTMLInputElement>(null);

  const updateCompany = (field: keyof typeof initialSettings.company, value: string) => {
    setSettings((current) => ({ ...current, company: { ...current.company, [field]: value } }));
  };

  const updateSystem = (field: keyof typeof initialSettings.system, value: string) => {
    setSettings((current) => ({ ...current, system: { ...current.system, [field]: value } }));
  };

  const updateNotification = (
    field: keyof typeof initialSettings.notifications,
    value: boolean,
  ) => {
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [field]: value },
    }));
  };

  const save = () => toast.success("Configurações salvas neste navegador.");

  const reloadAfterAction = () => {
    window.setTimeout(() => window.location.reload(), 650);
  };

  const clearAllData = () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja zerar todos os dados? Vendas, clientes, despesas, metas, usuários e lançamentos pessoais ficarão vazios.",
    );
    if (!confirmed) return;

    replaceLocalData(emptyData);
    toast.success("Dados zerados. Recarregando o sistema...");
    reloadAfterAction();
  };

  const restoreDemo = () => {
    const confirmed = window.confirm(
      "Restaurar os dados de demonstração vai substituir os dados atuais. Deseja continuar?",
    );
    if (!confirmed) return;

    restoreDemoData();
    toast.success("Dados de demonstração restaurados. Recarregando...");
    reloadAfterAction();
  };

  const exportBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      app: "VA Consultoria Manager",
      data: exportLocalData(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "backup-va-consultoria-manager.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado.");
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text()) as {
        data?: Partial<Record<DataKey, unknown>>;
      } & Partial<Record<DataKey, unknown>>;
      const importedData = payload.data ?? payload;
      const safeData = dataKeys.reduce(
        (acc, key) => {
          acc[key] = importedData[key] ?? [];
          return acc;
        },
        {} as Partial<Record<DataKey, unknown>>,
      );
      replaceLocalData(safeData);
      toast.success("Backup importado. Recarregando...");
      reloadAfterAction();
    } catch {
      toast.error("Não foi possível importar esse arquivo JSON.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Preferências da empresa, conta, notificações e dados"
        action={
          <Button variant="outline" onClick={() => setSettings(initialSettings)}>
            Restaurar padrões
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="font-display text-base font-semibold">Empresa</h3>
          <Separator className="my-4" />
          <div className="space-y-4">
            <SettingsField
              label="Razão social"
              value={settings.company.legalName}
              onChange={(value) => updateCompany("legalName", value)}
            />
            <SettingsField
              label="CNPJ"
              value={settings.company.cnpj}
              onChange={(value) => updateCompany("cnpj", value)}
            />
            <SettingsField
              label="E-mail comercial"
              value={settings.company.email}
              onChange={(value) => updateCompany("email", value)}
            />
            <SettingsField
              label="Telefone"
              value={settings.company.phone}
              onChange={(value) => updateCompany("phone", formatBrazilianPhone(value))}
            />
          </div>
          <Button className="mt-4 gradient-primary text-primary-foreground" onClick={save}>
            Salvar alterações
          </Button>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="font-display text-base font-semibold">Notificações</h3>
          <Separator className="my-4" />
          <div className="space-y-4">
            {[
              ["bills", "Alertas de contas vencendo"],
              ["daily", "Resumo diário por e-mail"],
              ["goals", "Alerta de meta em risco"],
              ["clients", "Novos clientes cadastrados"],
              ["insights", "Insights semanais"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <Label>{label}</Label>
                <Switch
                  checked={settings.notifications[key as keyof typeof settings.notifications]}
                  onCheckedChange={(value) =>
                    updateNotification(key as keyof typeof settings.notifications, value)
                  }
                />
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline" onClick={save}>
            Salvar notificações
          </Button>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Preferências do sistema</h3>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-3">
            <SettingsField
              label="Moeda padrão"
              value={settings.system.currency}
              onChange={(value) => updateSystem("currency", value)}
            />
            <SettingsField
              label="Fuso horário"
              value={settings.system.timezone}
              onChange={(value) => updateSystem("timezone", value)}
            />
            <SettingsField
              label="Formato de data"
              value={settings.system.dateFormat}
              onChange={(value) => updateSystem("dateFormat", value)}
            />
          </div>
          <Button className="mt-4" variant="outline" onClick={save}>
            Salvar preferências
          </Button>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Dados do sistema</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Zere os dados de demonstração para começar do zero, restaure a demo ou faça backup.
          </p>
          <Separator className="my-4" />
          <div className="grid gap-3 md:grid-cols-4">
            <Button variant="destructive" onClick={clearAllData}>
              Zerar tudo
            </Button>
            <Button variant="outline" onClick={restoreDemo}>
              Restaurar demo
            </Button>
            <Button variant="outline" onClick={exportBackup}>
              Exportar backup
            </Button>
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>
              Importar backup
            </Button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importBackup}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Ao zerar, o sistema fica vazio e pronto para você cadastrar novos clientes, vendas,
            despesas, metas, serviços, usuários e lançamentos pessoais.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SettingsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5" />
    </div>
  );
}
