# Plan - Melhoria de Estratégias e Automação de Conferência

O usuário solicitou uma série de melhorias visuais e funcionais no sistema de Lotofácil, focando em estatísticas, geração inteligente de cartões, automação de conferência e limpeza de interface.

## Mudanças Solicitadas

1.  **Melhoria em Estatística e Estratégia**:
    *   Implementar melhor estratégia entre concursos (ex: 10, 20, 30 ou mais).
    *   Gerar cartões com maior possibilidade e probabilidade de acertos.
2.  **Limpeza de Painel**:
    *   Ao clicar em "Limpar dezenas", zerar também os cartões gerados no painel.
3.  **Salvar para Conferência**:
    *   Opção clara de salvar cartões para futura conferência.
4.  **Automação ao Abrir**:
    *   Atualizar resultados automaticamente.
    *   Mostrar o último concurso e dezenas sorteadas.
    *   Buscar cartões salvos e mostrar quais foram premiados logo em seguida.

## Estratégia Técnica

### 1. Estatística e Geração Inteligente
*   **Ranking Multi-Janela**: Adicionar uma visualização comparativa de "Hot Numbers" em diferentes janelas (últimos 10, 20, 50 concursos) para identificar tendências de curto e longo prazo.
*   **Refinamento da Geração**: Ajustar a função `gerarApostas` (ou criar uma nova `gerarApostasOtimizadas`) para priorizar não apenas a frequência, mas também o equilíbrio entre Pares/Ímpares (7:8 ou 8:7), Primos (5 ou 6) e Soma (entre 180 e 210), que são padrões estatísticos comuns em resultados reais.

### 2. Comportamento da Interface
*   **Função `zerar`**: Atualizar a função de limpar dezenas no `src/routes/index.tsx` para também resetar os estados `geradas` e `apostas`.

### 3. Automação de Conferência
*   **Fluxo de Login/Entrada**: No `useEffect` de montagem da `Index`, após o carregamento dos concursos e dos cartões salvos na nuvem, disparar automaticamente uma conferência do último concurso oficial contra os lotes de cartões salvos.
*   **Visualização de Prêmios**: Destacar em um modal ou seção de destaque os cartões que obtiveram 11+ pontos no último concurso assim que o usuário entrar.

### 4. Mudanças de Texto
*   Substituir os placeholders de "language selector" conforme solicitado pelo usuário.

## Arquivos a serem modificados
- `src/routes/index.tsx`: Lógica de UI, conferência automática e estados de limpeza.
- `src/lib/lotofacil.functions.ts`: (Se necessário) Pequenos ajustes no fetch de múltiplos concursos.

## Verificação
- Testar o botão "Limpar" para garantir que limpa tudo.
- Simular a entrada no sistema com cartões salvos para verificar se a conferência automática é disparada.
- Validar se a nova estratégia de geração produz jogos equilibrados.