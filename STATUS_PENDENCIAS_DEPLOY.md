# Status de deploy e persistencia

## Situacao atual

- App publicado no Netlify: https://friendly-monstera-93e3dd.netlify.app/
- Supabase novo configurado localmente: projeto `caeymehcblsuxckspecs`
- Tabela de estado do app criada no Supabase: `financeiro_diego_app_state`
- Tabela de usuarios criada no Supabase: `financeiro_diego_app_users`
- Variaveis locais existem em `.env` e nao entram no Git.

## Problema encontrado

A rota abaixo esta retornando 404 no Netlify:

```text
https://friendly-monstera-93e3dd.netlify.app/api/state
```

Isso indica que a Netlify Function `netlify/functions/state.js` nao esta publicada no site atual.

## Efeito pratico

Enquanto `/api/state` estiver 404, o app salva alteracoes apenas no `localStorage` do navegador. Ao trocar de navegador, limpar cache, abrir em outro computador ou em algumas situacoes de recarregamento, as mudancas nao ficam persistidas no Supabase.

## O que falta para pleno funcionamento

1. Publicar o app por GitHub, Netlify CLI ou API, nao apenas por Netlify Drop.
2. Garantir que o Netlify leia o arquivo `netlify.toml`.
3. Confirmar que a Function `/api/state` responde 200.
4. Confirmar que uma alteracao no app gera registro em `financeiro_diego_app_state`.

## Configuracao esperada no Netlify

```text
Publish directory: app
Functions directory: netlify/functions
Build command: vazio
```

Variaveis:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STATE_TABLE=financeiro_diego_app_state
APP_STATE_ID=financeiro-diego-prod
```

## Melhor pratica recomendada

Criar um repositorio GitHub privado e conectar o projeto Netlify a esse repositorio. Assim, cada alteracao no app fica versionada e o Netlify publica automaticamente com Functions.
