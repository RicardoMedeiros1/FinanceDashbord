# Login e sincronização com o Supabase

Sem nada disso o Finn funciona só localmente (dados no navegador de cada aparelho). Seguindo estes passos, o app passa a
pedir e-mail e senha, e seus dados e comprovantes ficam na **sua** conta do Supabase, iguais em todos os aparelhos.

Tempo estimado: 10–15 minutos.

## 1. Criar o projeto

1. Crie uma conta em <https://supabase.com> e clique em **New project**.
2. Escolha um nome (ex.: `finn`), uma **senha forte** para o banco (guarde num gerenciador) e a região **South America (São Paulo)**.
3. Espere o projeto terminar de criar.

## 2. Criar as tabelas e as regras de segurança

1. No menu, abra **SQL Editor → New query**.
2. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](../supabase/schema.sql) e clique em **Run**.
3. Confira em **Table Editor** que existe a tabela `records` com o selo **RLS enabled**, e em **Storage** o bucket `receipts` **privado** (sem o selo "public").

O SQL é seguro para rodar de novo. Ele garante que cada usuário só lê e altera as próprias linhas e os próprios arquivos.

## 3. Criar o seu usuário e fechar o cadastro

Faça nesta ordem:

1. **Authentication → Users → Add user → Create new user**: informe seu e-mail e uma senha, e marque **Auto Confirm User**.
2. **Authentication → Sign In / Providers** (ou *Settings*, conforme a versão do painel): desligue **Allow new users to sign up**.
   Assim, mesmo com o app público, ninguém consegue criar conta. Só o usuário que você criou entra.
3. Mantenha o provedor **Email** ativo (é o que o app usa).

Se esquecer a senha, redefina em **Authentication → Users** (menu do usuário).

## 4. Pegar a URL e a chave pública

Em **Project Settings → API** (ou **Data API / API Keys**), copie:

- **Project URL** (`https://xxxx.supabase.co`)
- a chave **anon** / **publishable**

> Nunca use a chave **service_role** / **secret**: ela ignora todas as regras de segurança. A chave anon é feita para ficar no
> navegador; quem protege seus dados são as regras do passo 2 e o login.

## 5. Configurar o GitHub

No repositório: **Settings → Secrets and variables → Actions → aba Variables → New repository variable**. Crie duas:

| Nome                | Valor                    |
| ------------------- | ------------------------ |
| `SUPABASE_URL`      | o Project URL            |
| `SUPABASE_ANON_KEY` | a chave anon/publishable |

Depois rode **Actions → Deploy to GitHub Pages → Run workflow**. Quando terminar, abra o app: deve aparecer a tela de login.

Para testar no computador, copie `.env.example` para `.env.local`, preencha as duas variáveis e rode `npm run dev`.

## 6. Primeiro acesso em cada aparelho

- Entre com o e-mail e a senha do passo 3.
- Se o aparelho já tinha dados salvos, o app pergunta o que fazer: **enviar para a nuvem** (junta com o que já existe) ou **descartar**
  os deste aparelho. Escolha *descartar* se forem só dados de exemplo.
- Depois disso, o selo no topo mostra o estado: **Sincronizado**, **Sincronizando…** ou **Sem conexão** (as alterações ficam
  guardadas e são enviadas quando a internet voltar). Toque no selo para sincronizar na hora.

## Como conferir se está tudo certo

1. Entrar com senha errada mostra "E-mail ou senha incorretos".
2. Lançar uma transação no computador e ela aparecer no celular em alguns segundos.
3. Anexar um comprovante numa parcela paga e abri-lo no outro aparelho.
4. Em **Table Editor → records**, ver as linhas com o seu `user_id`. Em **Storage → receipts**, ver a pasta com o seu id.
5. Tentar abrir o app numa janela anônima sem logar: só a tela de login aparece.

## Cuidados

- **Projetos gratuitos podem ser pausados após um período sem uso.** Confira a regra atual no site do Supabase e use o app
  com frequência (ou exporte um backup em **Dados → Exportar backup** de vez em quando; ele é uma cópia dos seus dados em arquivo).
  Comprovantes não entram nesse backup.
- Sair da conta apaga os dados salvos **naquele aparelho** (eles continuam na nuvem).
- **Dados → Começar do zero**, com a nuvem ligada, apaga tudo da conta, em todos os aparelhos.
- Se duas alterações no **mesmo registro** acontecerem ao mesmo tempo (um aparelho offline), vale a que foi enviada por último.
- Nunca faça commit de chaves nem de backups no repositório público.
