---
name: commit-review
description: >-
  Antes de commitar, revisa o diff (staged ou proposto), aponta melhorias ou
  correções e entrega uma mensagem de commit pronta para colar. Use quando o
  usuário for commitar, pedir review antes do commit, mensagem de commit,
  git commit, preparar commit, ou staging para commit.
---

# Commit com code review e mensagem pronta

Quando o usuário **for commitar**, **pedir review antes do commit**, ou **pedir mensagem de commit**, seguir este fluxo **na ordem**. Não pular etapas.

## 1. Inspecionar as mudanças

- Preferir o que será commitado: `git diff --cached` (staged). Se ainda não houver stage, usar `git diff` e/ou `git status` e deixar claro se a análise é só do working tree.
- Se o escopo for um arquivo ou pasta, limitar a leitura ao diff relevante.

## 2. Code review (obrigatório)

Avaliar de forma objetiva, alinhada ao stack e estilo do repositório:

- **Correção**: bugs, edge cases, race conditions, dados inválidos, erros silenciosos.
- **Segurança**: segredos no diff, injeção, XSS, auth/autorização, validação de entrada.
- **Manutenção**: duplicação desnecessária, nomes confusos, responsabilidades misturadas, tipos frouxos.
- **Consistência**: padrões do projeto (imports, hooks, camadas, UI).
- **Testes**: cobertura do que mudou; se faltar teste óbvio, mencionar como sugestão (não bloquear o commit por isso salvo o usuário pedir gate estrito).

Classificar achados (use os rótulos):

- **Bloqueante**: corrigir antes de commitar (ou documentar risco se o usuário insistir).
- **Melhoria**: recomendado, não impede commit.
- **Opcional**: nit / polish.

Se não houver achados relevantes, declarar explicitamente algo como: "Nenhum problema crítico encontrado no diff analisado."

## 3. Mensagem de commit (final, copiável)

Ao **final** da resposta, incluir **apenas um** bloco de código markdown com **uma única linha**: a mensagem principal do commit — **sem** prefixos como "Mensagem sugerida:" dentro do bloco. O bloco deve ser só o texto que o usuário cola no `git commit -m "..."` ou num editor em modo uma linha.

Formato da mensagem (só a linha principal):

- [Conventional Commits](https://www.conventionalcommits.org/) em português ou inglês conforme o histórico do repositório (`git log -5 --oneline`).
- Formato: `tipo: descrição imperativa curta` — **sem parênteses** (não usar escopo do tipo `feat(escopo):` nem `fix(escopo):`).
- ≤ 72 caracteres quando possível.
- **Sem corpo** do commit: nada de linha em branco nem bullets abaixo; detalhes ficam na secção de review, não na mensagem.

Exemplo válido: `feat: add management UI and PATCH/DELETE API`

**Estrutura da resposta ao usuário:**

1. Secção **Review** (ou **Revisão**) com os achados por severidade.
2. Secção **Mensagem de commit** com um único bloco de código (triple backtick) contendo **exatamente uma linha** — só essa mensagem.

**Regras do bloco da mensagem:**

- Texto puro: sem markdown dentro do fence (sem `#`).
- Uma linha só; o usuário copia e cola direto (ex.: `git commit -m "feat: ..."`).
