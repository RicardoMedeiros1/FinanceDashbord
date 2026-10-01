import { ArrowLeft } from 'lucide-react'

const UPDATED = '02/10/2026'

/** Termos de uso e política de privacidade. Página pública (abre mesmo sem login). */
export function PrivacyPage() {
  return (
    <div className="doc">
      <a className="btn ghost back" href="#/"><ArrowLeft size={15} /> Voltar</a>
      <h1>Privacidade e termos de uso</h1>
      <p className="muted">Última atualização: {UPDATED}</p>

      <h2>O que é o Finn</h2>
      <p>O Finn é um app de finanças pessoais: você registra receitas, despesas, contas, cartões e parcelas, e ele organiza faturas, previsões e resumos. Ele não movimenta dinheiro e não acessa o seu banco.</p>

      <h2>Quais dados ficam guardados</h2>
      <ul>
        <li><strong>Conta:</strong> seu e-mail e a sua senha (a senha é guardada apenas de forma protegida, nunca em texto legível).</li>
        <li><strong>O que você digita ou importa:</strong> lançamentos, assinaturas, parcelas, contas, cartões, metas, orçamentos e o nome do perfil.</li>
        <li><strong>Comprovantes:</strong> as fotos e PDFs que você anexa às parcelas.</li>
        <li><strong>Registro de acessos:</strong> para segurança, cada tentativa de entrar na sua conta (certa ou errada) é registrada com o horário, o tipo de aparelho/navegador e o endereço IP, e fica visível para você em <em>Dados → Segurança</em>. Esses registros são apagados depois de cerca de 90 dias.</li>
        <li><strong>Dados do banco (opcional):</strong> se você conectar um banco pelo Open Finance (Meu Pluggy), o app busca contas, cartões e transações e os guarda na sua conta, como qualquer outro lançamento. Isso só acontece com a sua autorização, que você pode revogar no Meu Pluggy e no seu banco a qualquer momento; a conexão é usada só por quem o administrador liberar.</li>
      </ul>
      <p>O Finn <strong>não</strong> coleta localização, contatos nem dados de navegação, não usa anúncios ou rastreadores e não vende nem compartilha os seus dados com terceiros. Os extratos que você importa são lidos no seu navegador; só os lançamentos que você confirma são salvos.</p>

      <h2>Onde ficam</h2>
      <p>Os dados ficam no armazenamento do seu navegador (para funcionar mesmo sem internet) e, quando você entra com uma conta, também em um banco de dados e um armazenamento de arquivos na nuvem (Supabase), com acesso protegido por login e regras que permitem que cada pessoa leia e altere apenas os próprios dados.</p>
      <p>Quem administra o projeto na nuvem tem, tecnicamente, acesso ao banco, como acontece em qualquer serviço online. Se isso não for aceitável para você, use o app sem conta (dados só neste aparelho) ou execute a sua própria cópia do projeto.</p>

      <h2>Seus direitos</h2>
      <ul>
        <li><strong>Acessar e levar seus dados:</strong> em <em>Dados → Exportar backup</em>.</li>
        <li><strong>Corrigir:</strong> edite qualquer lançamento, conta ou cartão no próprio app.</li>
        <li><strong>Apagar:</strong> <em>Dados → Começar do zero</em> apaga os dados; <em>Dados → Excluir minha conta</em> apaga a conta, os dados e os comprovantes de forma definitiva.</li>
        <li><strong>Dúvidas ou pedidos</strong> sobre os seus dados: fale com quem administra este projeto (o dono do repositório onde o app está publicado).</li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a sua conta existir. Ao excluir a conta, os dados e os comprovantes são removidos. Cópias de segurança que você mesmo exportou continuam com você.</p>

      <h2>Armazenamento no navegador</h2>
      <p>O app usa o armazenamento do navegador (localStorage e IndexedDB) apenas para funcionar e guardar suas preferências, como o modo privacidade. Não usa cookies de rastreamento.</p>

      <h2>Limites e responsabilidades</h2>
      <ul>
        <li>Faturas, previsões, saldos e insights são <strong>estimativas</strong> calculadas a partir do que você informou. Confira sempre com o seu banco antes de decidir.</li>
        <li>O Finn não é consultoria financeira, contábil ou tributária.</li>
        <li>Você é responsável por manter a sua senha em segurança e por manter uma cópia de segurança dos dados que considera importantes.</li>
        <li>O serviço é oferecido como está, sem garantia de disponibilidade contínua.</li>
      </ul>

      <h2>Mudanças</h2>
      <p>Se estes termos mudarem, a data de atualização acima será alterada.</p>
    </div>
  )
}
