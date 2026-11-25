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
3. *(Opcional, para escreveres à tua maneira)* uma **chave gratuita da IA Gemini**, criada em <https://aistudio.google.com/apikey> com a mesma conta Google.

## Instalação (cerca de 5 minutos, uma vez)

1. Abre <https://script.google.com> com a conta Google dona do Firebase e carrega em **Novo projeto**. Dá-lhe o nome "Assistente Aniversário".
2. **Código:** apaga o conteúdo de `Code.gs` e cola todo o ficheiro [`Code.gs`](Code.gs) desta pasta.
3. **Configuração:**
   - à esquerda, abre ⚙️ **Definições do projeto** e ativa **"Mostrar ficheiro de manifesto appsscript.json no editor"**;
   - volta ao **Editor**, abre `appsscript.json` e substitui o conteúdo pelo de [`appsscript.json`](appsscript.json).
4. **O teu email:** no topo de `Code.gs`, troca `COLOCAR_O_TEU_EMAIL@icloud.com` pelo teu endereço iCloud. Só os emails desse endereço são aceites. Guarda com 💾.
5. **IA (opcional):** em ⚙️ **Definições do projeto → Propriedades do script → Adicionar propriedade**:
   - nome `GEMINI_API_KEY`;
   - valor: a tua chave do Gemini.

   Fica guardada só no teu Google, não no código.
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
| `sim` / `não` | Confirma ou cancela a alteração pendente (válida durante 30 min) |
| `ajuda` | Esta lista |

**Com a chave do Gemini**, também podes escrever à tua maneira, por exemplo:

- "põe o golfe às quatro e meia até às seis"
- "quem é que tem alergias?"
- "a Joana não pode vir"
- "muda a mensagem dos proibidos para: esta festa é só por convite"

Números das atividades: 01 Largo da Portagem · 02 Metrobus · 03 Mr. Pizza · 04 Passeio pela Baixa · 05 Torre de Almedina · 06 Regresso à Portagem · 07 Golfe · 08 Apresentação · 09 Lanche.

## Segurança

- **Quem é aceite:** só os emails do teu iCloud **com assinatura DKIM válida** do iCloud. Emails falsificados com o teu endereço são ignorados.
- **Confirmação:** toda a alteração pede "sim" e expira ao fim de 30 minutos.
- **Respostas dos convidados:** não podem ser apagadas por aqui.
- **IA:** a IA nunca grava diretamente. Só propõe; quem confirma és tu.
- **Privacidade:** no nível gratuito do Gemini, a Google pode usar o conteúdo dos pedidos para melhorar os seus produtos. Quando perguntas por respostas ou alergias, esses dados passam pelo Gemini. Se preferires evitar isso, não adiciones a chave e usa só os comandos simples, que não passam pela IA.

## Problemas comuns

- **Não responde:**
  - espera 1–2 minutos, porque verifica de minuto a minuto;
  - em script.google.com, vê **Execuções** à esquerda, onde aparecem os erros;
  - confirma que o email foi enviado do endereço configurado em `ICLOUD_EMAIL`.
- **"Firebase GET … → 401":** a conta do script não é dona do projeto Firebase, ou faltou autorizar. Corre `testarLigacao` outra vez.
- **"A IA não conseguiu responder":** a chave do Gemini está errada ou atingiu o limite gratuito. Os comandos simples continuam a funcionar. Podes mudar o modelo com a propriedade `GEMINI_MODEL`.
