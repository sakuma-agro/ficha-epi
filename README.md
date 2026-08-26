# Ficha de EPI · SAKUMA Agronegócios

Aplicativo web para cadastrar funcionários e imprimir as fichas de EPI em A4,
reproduzindo célula por célula a aba **Ficha EPI** da planilha
`FICHA DE EPI  NOVA 2025.xlsx`.

Funciona no computador e no celular, pode ser instalado como aplicativo
e continua abrindo sem internet.

---

## O que ele faz

- **Fichas** — marca os funcionários, preenche as linhas de EPI direto na tela
  (com sugestão do catálogo, que já completa o C.A) e imprime uma página por pessoa.
- **Funcionários** — cadastra, edita e desativa. Nome, nº de cadastro, admissão,
  cargo, empregador, CPF, setor, tamanhos e situação.
- **EPIs** — catálogo de equipamentos com C.A, observação e atividade.
- **Modelo da ficha** — muda os textos fixos impressos (título, legendas FAZ e
  M.E.R, declarações, rodapé), valendo para todos os usuários.

Tudo fica salvo no Supabase e é compartilhado entre os usuários. O que você
digita sem internet fica numa fila e sobe sozinho quando a conexão volta.

---

## Instalar no computador e no celular

Abra o endereço do app no navegador e:

- **Android / Chrome** — menu ⋮ → *Instalar aplicativo*.
- **iPhone / Safari** — botão compartilhar → *Adicionar à Tela de Início*.
- **Windows / Chrome ou Edge** — ícone de instalar na barra de endereço,
  ou o botão **Instalar app** no topo da tela.

---

## Configurar o Supabase (uma vez só)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase.sql`](supabase.sql) e clique em **Run**.
3. Em **Authentication → Providers → Email**, deixe ligado e **desligue
   "Confirm email"**.
4. Em **Authentication → Users → Add user**, crie os usuários que vão
   usar o app (e-mail e senha). Só eles conseguem entrar.
5. Em **Project Settings → API**, copie a **Project URL** e a chave
   **anon public**.
6. Abra o app, cole os dois valores e faça login.

Na primeira entrada, os **51 funcionários** e os **26 EPIs** da planilha
são carregados automaticamente.

### Sobre a chave anon

Ela é feita para ficar visível no navegador — quem protege os dados são as
regras de acesso (RLS) criadas pelo `supabase.sql`, que só liberam leitura e
escrita para usuários logados. Um visitante sem login não enxerga nada.
Por isso ela não fica gravada neste repositório: cada aparelho guarda a sua
localmente, na primeira configuração.

---

## Como a ficha foi reproduzida

As medidas saíram direto do arquivo `.xlsx`:

| Item | Origem |
|---|---|
| Larguras das colunas | A 10 · B 31 · C 11,29 · D 20,29 · E 49,14 · F 31 · G 49,43 · H 18,71 |
| Alturas das linhas | 25,15pt (cabeçalho) · 30pt (dados) · 20,25pt (declarações) · 49,9pt (tabela) |
| Escala de impressão | 42%, igual à configurada na planilha |
| Papel | A4 retrato, margens 20mm em cima/baixo e 13mm nas laterais |
| Fontes | Arial nos tamanhos originais (10 a 20pt), Times New Roman na linha de assinatura |
| Bordas | `medium` e `thin` do Excel, na mesma posição de cada célula |

Conferido contra o PDF gerado pela própria planilha: **181,7mm de largura**
(mesma medida) e diferença de altura abaixo de 4mm.

---

## Estrutura

```
index.html              telas e diálogos
css/app.css             interface + reprodução da ficha
js/app.js               eventos e navegação
js/store.js             Supabase, cache local e fila offline
js/ficha.js             montagem da ficha
js/seed.js              dados extraídos da planilha
vendor/supabase.js      biblioteca supabase-js 2.112.4
sw.js                   service worker (funciona sem internet)
supabase.sql            tabelas, índices e regras de acesso
```

Sem build, sem dependências para instalar: são arquivos estáticos.
Para rodar na sua máquina, `python3 -m http.server` na pasta e abra
`http://localhost:8000`.
