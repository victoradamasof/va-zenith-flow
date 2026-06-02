# Publicar o VA Consultoria Manager sem custo

O sistema publicado esta rodando pela Cloudflare Workers no dominio:

```text
https://manager.agenciablackbelt.com.br
```

## Deploy

1. Crie ou acesse sua conta gratuita em https://dash.cloudflare.com.
2. No terminal deste projeto, rode:

```bash
npm run deploy:login
```

3. Autorize a conta Cloudflare no navegador.
4. Depois rode:

```bash
npm run deploy
```

O deploy usa o Worker `va-consultoria-manager` e o dominio customizado `manager.agenciablackbelt.com.br`.

## Dados na nuvem

O deploy atual usa Cloudflare KV para manter um estado central do sistema em nuvem.

- O app publicado abre de qualquer lugar.
- O backup local existente foi enviado para o KV `VA_MANAGER_DATA`.
- Ao abrir o sistema em outro computador/celular, o app baixa os dados da nuvem e salva no navegador.
- Quando houver alteracoes dentro do sistema, os dados sao reenviados automaticamente para o KV.

Para uma fase mais robusta, com auditoria por usuario, historico de alteracoes e permissoes no servidor, o proximo passo recomendado e trocar esse estado central por um banco relacional online, como Cloudflare D1 ou Supabase.
