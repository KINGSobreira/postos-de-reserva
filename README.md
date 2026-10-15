# Postos de Reserva — Grupo SERVNAC

Site para os supervisores registrarem os colaboradores no posto de reserva:
- **Entrada na reserva**
- **Situação do dia**: Em cobertura, Não utilizado ou Ocorrência
- **Saída da reserva**

Os registros são gravados numa planilha Google.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O site. Vai para o GitHub. |
| `apps-script/Code.gs` | O script que grava na planilha. Fica aqui só como cópia: ele roda no Google Apps Script. |

## Passo 1: planilha e script (Google)

1. Crie uma planilha nova no Google Sheets, por exemplo "Postos de Reserva".
2. Abra o menu **Extensões → Apps Script**.
3. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de `Code.gs`. Salve.
4. No seletor de funções, no topo, escolha **setup** e clique em **Executar**. Autorize o acesso quando o Google pedir. O script cria as abas **Reservas**, **Movimentacoes** e **Planilha**.
5. Clique em **Implantar → Nova implantação**:
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Clique em **Implantar** e copie a **URL do app da Web**. Ela termina em `/exec`.

## Passo 2: site (GitHub)

1. Abra o `index.html` e localize esta linha, perto do início:
   ```js
   window.API_URL="COLE_AQUI_A_URL_DO_APPS_SCRIPT";
   ```
   Cole a URL do passo 1 entre as aspas e salve.
2. Envie o `index.html` para o repositório.
3. No repositório, abra **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main**, pasta **/ (root)**
   - Clique em **Save**
4. Em 1 ou 2 minutos o link fica disponível, no formato `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. É esse link que você manda para os supervisores.

## Onde ficam os dados

- **Aba Planilha**: as 14 colunas na ordem combinada. Ela se atualiza a cada lançamento e pode ser baixada pelo menu Arquivo → Fazer download → Excel.
- **Abas Reservas e Movimentacoes**: os dados completos, incluindo os campos que não estão nas 14 colunas, como nome do titular, motivo da ocorrência e detalhes da saída. Não edite essas abas à mão, para não quebrar os registros.
- O botão **Baixar planilha Excel** do site gera o mesmo arquivo da aba Planilha.

## Se alterar o `Code.gs` depois

Toda mudança no script só vale depois de uma nova versão: **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.
