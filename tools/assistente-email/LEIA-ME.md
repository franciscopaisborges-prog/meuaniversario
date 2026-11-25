# Assistente por email (Apple Watch / iCloud Mail)

Controla o aniversário a partir do Apple Watch, só com emails:

- **Envia um email** (ditado ou escrito no relógio) para a tua conta Gmail.
- **O assistente responde** no mesmo email, em 1 a 4 linhas.
- **Recebes um email** por cada nova confirmação de presença.
- **Nada muda sem confirmação:** antes de alterar o que quer que seja, o assistente pergunta "Confirmas? sim/não".
- **Custo:** grátis. Corre no Google Apps Script da tua conta Google, sem servidor nem número de telefone.

## O que precisas

1. A **conta Google dona do projeto Firebase** `aniversario-francisco`, a mesma do login da CLI.
2. O teu **endereço iCloud**, que o Watch usa no Mail.
3. *(Opcional, para escreveres à tua maneira)* uma **chave do OpenRouter**, criada em <https://openrouter.ai/settings/keys>. É gratuita para modelos gratuitos.

## Instalação (cerca de 5 minutos, uma vez)

1. Abre <https://script.google.com> com a conta Google dona do Firebase e carrega em **Novo projeto**. Dá-lhe o nome "Assistente Aniversário".
2. **Código:** apaga o conteúdo de `Code.gs` e cola todo o ficheiro [`Code.gs`](Code.gs) desta pasta.
3. **Configuração:**
   - à esquerda, abre ⚙️ **Definições do projeto** e ativa **"Mostrar ficheiro de manifesto appsscript.json no editor"**;
   - volta ao **Editor**, abre `appsscript.json` e substitui o conteúdo pelo de [`appsscript.json`](appsscript.json).
4. **O teu email:** em ⚙️ **Definições do projeto → Propriedades do script**, adiciona `ICLOUD_EMAIL` com o teu endereço iCloud (recomendado, porque não se perde ao atualizar o código). Em alternativa, troca `COLOCAR_O_TEU_EMAIL@icloud.com` no topo de `Code.gs`. Só os emails desse endereço são aceites. Guarda com 💾.
5. **IA (opcional):** em ⚙️ **Definições do projeto → Propriedades do script → Adicionar propriedade**:
   - nome `OPENROUTER_API_KEY`;
   - valor: a tua chave do OpenRouter.

   Fica guardada só no teu Google, não no código. Por defeito usa `openrouter/free`, que escolhe sozinho um modelo gratuito disponível. Para fixar um modelo, adiciona também `OPENROUTER_MODEL` com o nome do modelo, por exemplo um terminado em `:free` que suporte "tools", como indica a página do modelo em openrouter.ai.
6. **Teste de ligação:**
   - no editor, escolhe a função **`testarLigacao`** e carrega em **Executar**;
   - a Google pede autorização: **Rever permissões** → escolhe a conta → **Avançadas** → **Aceder a Assistente Aniversário (não seguro)** → **Permitir**. O aviso aparece porque o programa é teu e não foi publicado. As permissões são: ler e enviar emails, aceder ao Firebase e correr de minuto a minuto;
   - no **Registo de execução** deve aparecer o resumo das respostas, ou "Ainda não há respostas".
7. **Ligar:** escolhe a função **`instalar`** e carrega em **Executar**. Recebes no iCloud um email "assistente ligado" com a lista de comandos.
8. **No iPhone/Watch:** guarda o endereço Gmail nos contactos com o nome **Aniversário**. No Watch: **Mail → Nova mensagem → Aniversário**, e ditas o pedido.

Para desligar, corre a função `desinstalar`.

## Como falar com ele

| Escreve | O que acontece |
|---|---|
| `respostas` | Quantos vão, alergias, quem não tem cartão Move C |
| `nomes` | Lista de quem respondeu |
| `horarios` | Horários atuais das 9 atividades |
| `hora 7 16:00` ou `hora 7 16:00-18:00` | Muda o horário da atividade 7 (pede confirmação) |
| `sem hora 7` | Atividade 7 passa a "A confirmar" |
| `proibir Joana` / `permitir Joana` | Nomes proibidos (pede confirmação) |
| `proibidos` | Lista de nomes proibidos e a mensagem |
| `visitas` | Visitas ao site e a hora com mais visitas |
| `emails ligar` / `emails desligar` | Emails do EmailJS |
| `atualizar` | Recarrega as páginas do site que estão abertas |
| `ver Joana` | Todos os dados de um convidado |
| `apagar Joana` | Apaga a resposta da Joana (pede confirmação) |
| `apagar todas as respostas` | Apaga todas as respostas, por exemplo as de teste (pede confirmação) |
| `sim` / `não` | Confirma ou cancela a alteração pendente (válida durante 30 min) |
| `ajuda` | Esta lista |

**Com a chave do OpenRouter**, também podes escrever à tua maneira, por exemplo:

- "põe o golfe às quatro e meia até às seis"
- "quem é que tem alergias?"
- "a Joana não pode vir"
- "muda a mensagem dos proibidos para: esta festa é só por convite"
- "apaga os convites de teste" / "tira todos os que disseram que não"
- "o Rui afinal vem e é alérgico a marisco"
- "a Ana respondeu por mensagem, vem e não tem cartão"
- várias coisas de uma vez: vêm numa só lista com um "Confirmas?"

Lembra-se das últimas mensagens durante 30 minutos, por isso percebe "e a outra?" ou "apaga essa". Para o que não tiver uma ação própria, consegue ler e alterar qualquer dado do site, exceto os administradores, sempre com confirmação.

Números das atividades: 01 Largo da Portagem · 02 Metrobus · 03 Mr. Pizza · 04 Passeio pela Baixa · 05 Torre de Almedina · 06 Regresso à Portagem · 07 Golfe · 08 Apresentação · 09 Lanche.

## Segurança

- **Quem é aceite:** só os emails do teu iCloud **com assinatura DKIM válida** do iCloud. Emails falsificados com o teu endereço são ignorados.
- **Confirmação:** toda a alteração pede "sim" e expira ao fim de 30 minutos.
- **Respostas dos convidados:** podem ser apagadas ou corrigidas, mas sempre com confirmação. A lista mostra os nomes antes do "sim".
- **Administradores:** nunca podem ser mudados por email.
- **IA:** a IA nunca grava diretamente. Só propõe; quem confirma és tu.
- **Privacidade:** nos modelos gratuitos do OpenRouter, os pedidos podem ficar registados pelo fornecedor do modelo; a página do `openrouter/free` indica que regista os pedidos. Quando perguntas por respostas ou alergias, esses dados passam pelo OpenRouter. Se preferires evitar isso, não adiciones a chave e usa só os comandos simples, que não passam pela IA.

## Problemas comuns

- **Tempo de resposta:** a primeira mensagem demora até 1 minuto, porque o Google só deixa correr de minuto a minuto. Durante 3 minutos depois de cada mensagem, o assistente verifica de 10 em 10 segundos e responde em cerca de 10–20 s. Fora disso volta a 1 vez por minuto, para respeitar o limite gratuito do Google de 90 minutos de execução por dia.
- **Não responde:**
  - espera 1–2 minutos;
  - em script.google.com, vê **Execuções** à esquerda, onde aparecem os erros;
  - confirma que o email foi enviado do endereço configurado em `ICLOUD_EMAIL`.
- **"Firebase GET … → 401":** a conta do script não é dona do projeto Firebase, ou faltou autorizar. Corre `testarLigacao` outra vez.
- **"A IA não conseguiu responder (OpenRouter HTTP …)":**
  - **401:** chave errada;
  - **402:** sem créditos, para modelos pagos;
  - **429:** limite diário gratuito atingido;
  - **404 ou "No endpoints … tools":** o modelo não existe ou não suporta ferramentas. Troca a propriedade `OPENROUTER_MODEL`.

  Os comandos simples continuam sempre a funcionar.
