# Segurança do Finn

O Finn guarda dados financeiros, então a segurança tem camadas. Este guia explica **o que o app já faz**, **o que você precisa
configurar no Supabase e no GitHub** e **quais são os limites** (para você não ficar com falsa sensação de segurança).

## O que o app faz

| Camada | O que protege | Onde fica |
|---|---|---|
| **Verificação em duas etapas (2FA)** | Mesmo com a senha vazada, ninguém entra sem o código do seu celular. É **obrigatória**: no primeiro login depois de atualizar, o app pede para cadastrar. | App + Supabase Auth |
| **2FA exigido pelo banco** | Depois de rodar `supabase/security-2fa.sql`, o próprio banco só entrega dados a sessões verificadas, até se alguém falar direto com a API. | Banco |
| **Registro de tentativas de acesso** | Cada login (certo ou errado) fica anotado com horário, aparelho e IP; você vê em *Dados → Segurança* e o app avisa se houve tentativas erradas. | Função `access` + tabela `login_attempts` |
| **Bloqueio por excesso de erros** | 5 senhas erradas para o mesmo e-mail (ou 20 do mesmo IP) bloqueiam por 15 minutos, até para a senha certa. | Função `access` |
| **Sair de todos os aparelhos** | Encerra todas as sessões de uma vez (perdeu o celular? suspeita de acesso?). | App + Supabase Auth |
| **Bloqueio com PIN** | Trava o app neste aparelho (ao abrir, depois de um tempo fora, ou sob demanda). O PIN é guardado só como hash (PBKDF2) e erros repetidos geram esperas; com conta, 10 erros seguidos saem da conta no aparelho. | App (neste aparelho) |
| **Senha longa** | O app exige 12 caracteres ou mais. | App (+ Supabase, veja abaixo) |
| **Política de conteúdo (CSP)** | O app só carrega código dele, só fala com o seu Supabase e com o Banco Central, e não aceita script injetado. Fontes são servidas pelo próprio app (nada do Google). | Build do app |
| **Banco de dados com RLS** | Cada usuário só lê e grava as próprias linhas; comprovantes ficam em pasta privada por usuário. | `supabase/schema.sql` |
| **Dados do banco (Open Finance)** | A chave da Pluggy fica só no servidor; a função exige login + 2FA + e-mail liberado. | Função `pluggy` |

## O que você precisa configurar (uma vez)

### 1. Ativar o 2FA no app
Atualize o app e entre. Ele mostra um QR code: escaneie com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy,
1Password...) e digite o código de 6 dígitos. **Guarde bem o acesso a esse aplicativo**; se possível, faça backup dele ou use um que sincronize.

> No Supabase, o 2FA por aplicativo (TOTP) vem ligado. Se o app disser que está desligado: **Authentication → Sign In / Providers → Multi-Factor → TOTP → Enable**.

### 2. Registro de acessos e bloqueio (função `access`)
1. **SQL Editor**: cole e execute `supabase/security-log.sql` (cria a tabela `login_attempts`).
2. **Edge Functions → Deploy a new function → Via Editor**: nome `access`; cole o conteúdo de `supabase/functions/access/index.ts`; **Deploy**. Não precisa de secrets (o Supabase já entrega `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` às funções).
3. Teste: erre a senha 3 vezes e veja o aviso "Restam 2 tentativas…"; entre e abra *Dados → Segurança → Acessos recentes*.

Enquanto a função não estiver publicada, o login funciona direto (sem registro nem bloqueio).

### 3. Fazer o banco exigir o 2FA
**Depois** de cadastrar o 2FA no app (em todos os usuários), execute `supabase/security-2fa.sql` no SQL Editor. Dali em diante, sem o código, nenhuma sessão lê ou grava dados.
Para desfazer, as instruções estão no fim do arquivo.

### 4. Ajustes no painel do Supabase
- **Authentication → Sign In / Providers → Email → Minimum password length**: `12` (o app exige o mesmo).
- **Authentication → Rate Limits**: confira os limites de login e e-mails; não aumente.
- **Authentication → Sign In / Providers**: mantenha *Allow new users to sign up* **desligado** (só entra quem você convida).
- **Authentication → URL Configuration**: Site URL e Redirect URLs só com o endereço do app.
- **Project Settings → Auth** (se disponível no seu plano): *Leaked password protection*, *tempo máximo de sessão* e *inatividade* ajudam; são recursos de planos pagos.
- **Não ligue o CAPTCHA** (Authentication → Attack Protection) por enquanto: o app ainda não o suporta e o login deixaria de funcionar.

### 5. Suas contas (a parte mais importante)
Quem controla o Supabase e o GitHub controla tudo. **Ative o 2FA na sua conta do Supabase, do GitHub e do e-mail** que usa neles, e use senhas únicas (um gerenciador de senhas ajuda).
No GitHub, mantenha ligados os alertas de segurança e o *secret scanning* (Settings → Code security). O arquivo `.github/dependabot.yml` já pede atualizações semanais de dependências.

## Perdi o celular do 2FA

1. No painel do Supabase: **Authentication → Users →** seu usuário **→ Delete factor** (remover o fator de MFA).
2. Entre no app com e-mail e senha: ele pede para cadastrar o novo aplicativo.

Se perder também o acesso ao painel do Supabase, use a recuperação de conta do Supabase (por isso o 2FA e o e-mail dessa conta importam).

## Limites (leia)

- **O bloqueio por tentativas só vale para quem passa pelo app/função `access`.** Quem falar direto com a API pública do Supabase não é registrado nem bloqueado por ela. Nesse caso, quem protege são: o **2FA** (sem o código não lê dado nenhum, principalmente depois do `security-2fa.sql`) e os **limites do próprio Supabase** (Authentication → Rate Limits).
- **O PIN é uma trava de tela, não criptografia.** Os dados do app ficam no armazenamento do navegador deste aparelho; alguém com acesso técnico ao aparelho desbloqueado pode ler. Use também o bloqueio de tela do celular/computador e o disco criptografado.
- **Os dados passam pelo seu Supabase e (se usar Open Finance) pela Pluggy.** Escolha bem quem tem acesso aos projetos.
- **Nada aqui substitui bons hábitos**: não instale extensões desconhecidas no navegador onde usa o app, atualize o sistema e não use computadores de terceiros.
- Revise de tempos em tempos *Dados → Segurança → Acessos recentes* e **Authentication → Users / Logs** no Supabase.
