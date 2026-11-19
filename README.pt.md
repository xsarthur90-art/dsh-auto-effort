<p align="center">
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.md">English</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.zh.md">简体中文</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ja.md">日本語</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.es.md">Español</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.fr.md">Français</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.de.md">Deutsch</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ru.md">Русский</a> ·
  <b>Português</b>
</p>

# dsh-auto-effort · Esforço automático

Pare de escolher um esforço. Instale uma vez e **o DeepSeek escolhe para cada mensagem**.

Algo quebrou? [Abra uma issue](https://github.com/xsarthur90-art/dsh-auto-effort/issues/new/choose) — inclua a versão do plug-in e as últimas linhas de `~/.dsh/auto-effort.log`.

## Mais barato, mais rápido, mais tranquilo — custo à vista, troque quando quiser

![O menu do modelo com a linha Esforço automático](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/menu-pt.png)

- **Mais barato**: escolher o esforço à mão costuma dar errado — baixo demais gera retrabalho e mais gasto, alto demais queima tokens. O automático custa só cerca de `$0.0002` extra por mensagem fora do horário de pico, cerca de `$0.0004` no pico.
- **Mais rápido**: escolher à mão leva dois cliques e 2–3 s; uma escolha baixa demais obriga a refazer o trabalho, e uma alta demais desperdiça tempo de raciocínio. O automático acrescenta apenas cerca de **0,7 s** por mensagem.
- **Mais tranquilo**: chega de pesar "low ou max" a cada mensagem e de "ops, esforço errado". Diga só o que quer; o esforço acompanha. **Sem ansiedade!**
- **Custo à vista**: a linha do menu mostra as execuções, o custo e o tempo de avaliação desta conversa, e a página do plug-in mantém um total acumulado.
- **Troque quando quiser**: desligue quando não quiser, ligue quando quiser.

![A página do plug-in, com os totais acumulados](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/plugin-page-pt.png)

## Como ele avalia

O plug-in se conecta ao modelo DeepSeek mais recente. Ele resume a conversa e mantém, em segundo plano, uma ficha de no máximo 120 caracteres. A cada mensagem enviada, ele lê essa mensagem junto com a ficha e escolhe um dos quatro esforços. A ficha registra o que a conversa está fazendo e o que falta, então "ok, pode ir" é avaliado pelo trabalho pendente, e não pelo próprio tamanho.

| Esforço | Para que o DeepSeek o escolhe | Exemplo medido |
|---|---|---|
| `off` | conversa, confirmações, consultas, edição de configuração, execução de comandos | listar o diretório atual |
| `low` | pequenas edições, renomeações, organização, aplicação de um padrão conhecido | renomear estas variáveis de forma consistente |
| `high` | análise, depuração, explicar o porquê, código não trivial | me ajude a descobrir por que esta abordagem é lenta |
| `max` | arquitetura, comparação de opções, trade-offs de vários fatores, bugs difíceis | rastrear no log a causa raiz deste vazamento de memória intermitente |

> O DeepSeek documenta o parâmetro de força (`low` / `high` / `max`, além de `off` para desligar o raciocínio), mas **nunca diz que tipo de tarefa pertence a cada esforço**. A tabela acima é o que o avaliador do DeepSeek sugere sozinho, sem nenhuma entrada humana; cada exemplo foi testado no avaliador real.

## Custo

O plug-in faz uma avaliação e uma atualização de ficha por mensagem. A avaliação só responde uma palavra — off, low, high ou max —, por isso quase não gasta tokens e leva cerca de 0,7 s. A ficha tem no máximo 120 caracteres, então nunca cresce com a conversa. A ficha é escrita em segundo plano depois da resposta e nunca aumenta sua espera.

| Por mensagem | Fora do pico | Pico |
|---|---|---|
| Avaliação + ficha | cerca de `$0.0002` | cerca de `$0.0004` |

## Instalação

Três formas; escolha uma.

**1. Deixe o DSH instalar** — envie isto em qualquer conversa:

```
Instale o plug-in dsh-auto-effort
```

**2. Linha de comando**:

```
plugin_manager install_bundle dsh-auto-effort
```

**3. Página de plug-ins** — abra **Plug-ins** na barra lateral, busque `dsh-auto-effort` e clique em **Instalar**.

Uma linha que comece com `+ dsh-auto-effort` significa que funcionou.

**Depois de instalar ou atualizar o plug-in, reinicie o DSH.**

Vai atualizar depois? O [CHANGELOG.md](https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/CHANGELOG.md) diz o que muda em cada versão — vale a pena olhar antes de reiniciar o DSH.

## Ligar e desligar

**Ligado**

Fica ligado no momento em que é instalado: uma conversa nova começa a selecionar automaticamente na hora, e **uma conversa que já estava aberta começa quando você reinicia o DSH.**

**Desligado**

- Desligue **Esforço automático** no menu do modelo: só esta conversa.
- Escolha qualquer esforço à mão: isso também desliga o automático na conversa atual.
- Desligue o plug-in na página do plug-in: todas as conversas param de selecionar automaticamente.

## Configuração

Normalmente você não precisa editar nada disso. Tudo abaixo serve para ajuste fino e solução de problemas, e os padrões servem para quase todo mundo.

| Campo | Padrão | Significado |
|---|---|---|
| `enabled` | `true` | interruptor principal; desligado, nenhuma lógica de avaliação é carregada |
| `mode` | `auto` | o padrão para conversas novas: `auto` avalia cada mensagem, `manual` só passa adiante o controle; o interruptor do menu muda a conversa em que você está |
| `levels` | `["off","low","high","max"]` | esforços que o modo automático pode usar |
| `judgeModel` | `deepseek-flash` | modelo usado para avaliar; em branco ou `model` avalia com o modelo desta mesma conversa |
| `timeoutMs` | `3000` | tempo limite da avaliação; no tempo limite, usa-se o esforço atual |
| `defaultLevel` | `null` | esforço de reserva quando a avaliação falha; `null` mantém o esforço atual |
| `requireMaxForUpgrade` | `false` | desligado por padrão, para o automático poder escolher o nível máximo `max`; ligado, o automático para em `high` e `max` fica só no manual |
| `logFile` | `null` | caminho do log; `null` significa `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | quanto da resposta o gerador da ficha lê; menor é mais barato, mas a precisão pode cair |
| `cardMaxChars` | `120` | limite do próprio texto da ficha; menor é mais barato, mas a precisão pode cair |
| `debug` | `false` | log detalhado, incluindo a saída bruta do avaliador |

## Enviar enquanto um turno está em execução

**Configurações → Geral → Enviar comportamento enquanto estiver ocupado** decide o que acontece com uma mensagem que você envia enquanto uma resposta ainda está sendo escrita:

- **Orientar** — ela entra no turno em execução e mantém o esforço desse turno.
- **Fila** — ela se comporta exatamente como uma mensagem normal.

## Se nada acontecer

1. Verifique se o plug-in está **ativado** na página do plug-in (**Plug-ins → Plug-ins instalados**).
2. Se a conversa já existia quando você o instalou, reinicie o DSH uma vez.
3. Verifique se **Esforço automático** no menu do modelo continua ligado — escolher um esforço à mão só o desliga nesta conversa.
4. Leia o log em `~/.dsh/auto-effort.log` — cada mensagem escreve uma linha `turn N judging …`.
5. Se um turno der erro de API, ou a avaliação falhar três vezes seguidas, o plug-in pausa esta conversa e uma barra acima da caixa de entrada explica o porquê. Pressione **Ativar novamente** nessa barra, ou desligue e ligue o interruptor de novo — sem precisar reiniciar.

## Desinstalação

**Plug-ins → Plug-ins instalados → dsh-auto-effort → Desinstalar.** A avaliação para; a configuração que ele adicionou é removida.

## Desenvolvimento

- Fonte: `index.js` (a metade do host), `client.js` (o interruptor no menu do modelo e o aviso de pausa), `judge.js` (as duas chamadas ao avaliador), `config.js` (validação sem dependências), `schema.js` (esquema de configuração), `stats.js` e `server.js` (o contador local de custo e o interruptor por conversa por trás dos números).
- Instalar a partir de um diretório local (`install_bundle <dir>`) é um caminho de desenvolvedor — usuários comuns nunca instalam assim; faça backup do diretório antes de remover o plug-in.
- `npm test` executa três suítes offline: configuração/parse/timeout, a ligação da tomada de controle e do interruptor por conversa (incluindo o status do aviso de pausa), e o sidecar de loopback.
