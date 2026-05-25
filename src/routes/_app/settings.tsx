import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — VA" }] }),
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências da empresa, conta e notificações" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="font-display text-base font-semibold">Empresa</h3>
          <Separator className="my-4" />
          <div className="space-y-4">
            <div><Label>Razão social</Label><Input defaultValue="VA Consultoria LTDA" className="mt-1.5" /></div>
            <div><Label>CNPJ</Label><Input defaultValue="12.345.678/0001-90" className="mt-1.5" /></div>
            <div><Label>E-mail comercial</Label><Input defaultValue="contato@vaconsultoria.com" className="mt-1.5" /></div>
            <div><Label>Telefone</Label><Input defaultValue="(11) 4002-8922" className="mt-1.5" /></div>
          </div>
          <Button className="mt-4 gradient-primary text-primary-foreground">Salvar alterações</Button>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6">
          <h3 className="font-display text-base font-semibold">Notificações</h3>
          <Separator className="my-4" />
          <div className="space-y-4">
            {[
              ["Alertas de contas vencendo", true],
              ["Resumo diário por e-mail", true],
              ["Alerta de meta em risco", true],
              ["Novos clientes cadastrados", false],
              ["Insights semanais", true],
            ].map(([label, on]) => (
              <div key={label as string} className="flex items-center justify-between">
                <Label>{label as string}</Label>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Preferências do sistema</h3>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Moeda padrão</Label><Input defaultValue="BRL (R$)" className="mt-1.5" /></div>
            <div><Label>Fuso horário</Label><Input defaultValue="America/Sao_Paulo" className="mt-1.5" /></div>
            <div><Label>Formato de data</Label><Input defaultValue="DD/MM/YYYY" className="mt-1.5" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
