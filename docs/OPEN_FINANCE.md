# Conectar o banco (Open Finance com o Meu Pluggy)

O Finn pode trazer **contas, cartões e transações** direto do seu banco, pelo Open Finance, usando o
[Meu Pluggy](https://meu.pluggy.ai) (gratuito para uso pessoal). Você autoriza no próprio banco e pode revogar quando quiser.

Como as credenciais da Pluggy **não podem ficar no navegador** (o app e o repositório são públicos), elas ficam numa
*Edge Function* do seu Supabase (`supabase/functions/pluggy/index.ts`). O app chama essa função já logado.

```
Finn (navegador) ──login──▶ Função "pluggy" no Supabase ──chave secreta──▶ API da Pluggy ◀── Meu Pluggy ◀── seu banco
```

> Pré-requisito: o login com Supabase já configurado ([SUPABASE.md](SUPABASE.md)). Sem nuvem o botão de bancos não aparece.

## Limites (confira no site da Pluggy, pois mudam)

- O Meu Pluggy é para **uso pessoal**: vale para as **suas** contas (até 5 conexões, todas do mesmo titular, segundo a Pluggy).
  Para outras pessoas conectarem os bancos delas seria preciso um plano comercial. Por isso a função só atende os e-mails que você liberar.
- Nem todo banco/cartão está disponível, e o consentimento precisa ser renovado de tempos em tempos no Meu Pluggy.
- A Pluggy atualiza os dados de cada conexão por conta própria (diariamente, segundo o projeto Meu Pluggy). O Finn busca esses dados; ele não força o banco a atualizar.

## 1. Conectar o banco no Meu Pluggy

1. Entre em <https://meu.pluggy.ai> e crie sua conta.
2. Conecte cada banco (botão principal → escolha a instituição → autorize no app/site do banco).

## 2. Pegar as credenciais de desenvolvedor

Segundo o [README do Meu Pluggy](https://github.com/pluggyai/meu-pluggy):

1. Crie uma conta no [Dashboard da Pluggy](https://dashboard.pluggy.ai) (começa com 15 dias de teste; depois disso você continua podendo puxar as informações, segundo o projeto).
2. Em **Customize** da sua aplicação, inclua o conector **MeuPluggy** na lista.
3. Crie uma **Development Application**: ela gera o **Client ID** e o **Client Secret**. Guarde os dois (o secret só se vê uma vez).
4. Abra a aplicação **Demo** do dashboard e faça o vínculo com o Meu Pluggy (autorização OAuth). **Repita uma vez para cada banco** conectado no Meu Pluggy.
5. Ao concluir, o Demo mostra o resultado com o **Item ID** da conexão: uma sequência como `3fa85f64-5717-4562-b3fc-2c963f66afa6`. Copie um Item ID para cada banco.
   Se não achar o Item ID, pergunte no [Discord do Meu Pluggy](https://discord.gg/EanrwJADby) ou consulte a [documentação](https://docs.pluggy.ai).

## 3. Publicar a função no Supabase

**Pelo painel (sem instalar nada):**

1. No Supabase: **Edge Functions → Deploy a new function → Via Editor**.
2. Nome da função: `pluggy` (exatamente).
3. Apague o exemplo e cole todo o conteúdo de `supabase/functions/pluggy/index.ts` deste repositório.
4. Deixe **Verify JWT** ligado e clique em **Deploy**.

**Ou pela linha de comando** (Supabase CLI): `supabase functions deploy pluggy --project-ref SEU_PROJETO`.

## 4. Cadastrar os secrets

Em **Edge Functions → Secrets** (ou **Project Settings → Edge Functions**), adicione:

| Nome | Valor |
|---|---|
| `PLUGGY_CLIENT_ID` | o Client ID do passo 2 |
| `PLUGGY_CLIENT_SECRET` | o Client Secret do passo 2 |
| `PLUGGY_ALLOWED_EMAILS` | o seu e-mail de login no Finn (vários: separe por vírgula) |

`SUPABASE_URL` e `SUPABASE_ANON_KEY` o próprio Supabase já entrega à função. Depois de mudar secrets, se necessário, publique a função de novo.

> Sem `PLUGGY_ALLOWED_EMAILS` **ninguém** consegue usar a função (é de propósito: ela usa a sua conta da Pluggy).

## 5. Usar no Finn

1. Entre no app e toque no ícone do banco no topo (**Bancos (Open Finance)**).
2. Informe o **nome do banco** (ex.: Nubank), o **Item ID** e desde quando importar o histórico (padrão: 90 dias). **Conectar e importar**.
3. Na primeira vez o app cria as **contas** (com saldo inicial que fecha com o saldo do banco hoje) e os **cartões** (com fechamento, vencimento e limite quando o banco informa; confira em *Cartões*), e importa as transações.
4. Depois, **Sincronizar agora** traz só o que é novo. O app também atualiza sozinho ao abrir se a última sincronização tem mais de 6 horas.

### O que o Finn faz e não faz

- **Não duplica:** cada movimento do banco tem um id fixo. Sincronizar de novo não repete nada.
- **Lançamentos que você já fez à mão** (mesma data, tipo e valor) **não são importados de novo**: ficam numa lista *Não importados* (com o botão *Importar mesmo assim*), e o seu lançamento passa a valer na conta/cartão do banco.
- **Pagamento de fatura** feito pela conta não entra como despesa (as compras do cartão já contam no dia em que foram feitas). Registre em **Cartões → Pagar fatura** para o saldo da conta fechar.
- **Estornos e "pagamento recebido" no cartão** são ignorados.
- **Movimentos pendentes** só entram quando o banco os confirma.
- Transferências entre as suas próprias contas aparecem como receita/despesa; ajuste-as (ou use *Transferir*) se quiser.
- Remover uma conexão **não apaga** o que já foi importado.

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "A função "pluggy" não está publicada" | Passo 3: o nome precisa ser exatamente `pluggy`. |
| "ainda não foi configurada… PLUGGY_CLIENT_ID" | Passo 4. |
| "A Pluggy recusou as credenciais" | Client ID/Secret errados, ou de outra aplicação. |
| "Este e-mail não está liberado" | Coloque o seu e-mail em `PLUGGY_ALLOWED_EMAILS`. |
| "a Pluggy não encontrou essa conexão" | Item ID errado, ou o vínculo do Demo (passo 2.4) não foi feito para esse banco. |
| "a conexão está com a situação LOGIN_ERROR / OUTDATED…" | Reconecte o banco no Meu Pluggy e refaça o vínculo. |

## Segurança

- Client ID/Secret ficam **só** nos secrets do Supabase; nunca no código, no `.env` do app nem no GitHub.
- A função exige login válido **e** e-mail liberado, e só aceita Item IDs no formato correto.
- Os dados do banco passam pelo seu Supabase e ficam na sua conta do Finn, como qualquer outro lançamento. Veja também [Privacidade e termos](../src/pages/Privacy.tsx).
