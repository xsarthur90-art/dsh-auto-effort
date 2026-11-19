<p align="center">
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.md">English</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.zh.md">简体中文</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ja.md">日本語</a> ·
  <b>Español</b> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.fr.md">Français</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.de.md">Deutsch</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ru.md">Русский</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.pt.md">Português</a>
</p>

# dsh-auto-effort · Esfuerzo automático

Deja de elegir un esfuerzo. Instálalo una vez y **DeepSeek elegirá uno por cada mensaje**.

## Más barato, más rápido, más tranquilo: coste a la vista, cámbialo cuando quieras

![El menú del modelo con la fila Esfuerzo automático](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/menu-es.png)

- **Más barato**: elegir el esfuerzo a mano suele significar equivocarse: demasiado bajo implica rehacer el trabajo y gastar más; demasiado alto consume tokens. El modo automático solo cuesta unos `$0.0002` extra por mensaje en horas valle y unos `$0.0004` en horas punta.
- **Más rápido**: elegir a mano requiere dos clics y 2–3 s; una elección demasiado baja obliga a rehacer el trabajo y una demasiado alta desperdicia tiempo de razonamiento. El modo automático solo añade unos **0,7 s** por mensaje.
- **Más tranquilo**: se acabó sopesar «low o max» en cada mensaje y se acabó el «uy, me equivoqué de esfuerzo». Basta con decir lo que quieres; el esfuerzo se ajusta solo. **¡Sin agobios!**
- **Coste a la vista**: la fila del menú muestra las ejecuciones de esta conversación, el coste y el tiempo de evaluación, y la página del complemento mantiene un total acumulado.
- **Cámbialo cuando quieras**: desactívalo cuando no lo quieras y actívalo cuando sí.

![La página del complemento, con los totales acumulados](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/plugin-page-es.png)

## Cómo decide

El complemento se conecta al modelo más reciente de DeepSeek. Resume la conversación y mantiene en segundo plano una ficha de 120 caracteres como máximo. Cada vez que envías un mensaje, lee ese mensaje junto con la ficha y elige uno de los cuatro esfuerzos. La ficha registra qué está haciendo la conversación y qué queda pendiente, de modo que «vale, adelante» se evalúa según el trabajo pendiente y no según su propia longitud.

| Esfuerzo | Para qué lo elige DeepSeek | Ejemplo medido |
|---|---|---|
| `off` | charla, confirmaciones, consultas, edición de configuración, ejecución de comandos | lista el directorio actual |
| `low` | ediciones pequeñas, renombrados, orden y limpieza, aplicar un patrón conocido | renombra estas variables de forma coherente |
| `high` | análisis, depuración, explicar el porqué, código no trivial | ayúdame a averiguar por qué este enfoque es lento |
| `max` | arquitectura, comparación de opciones, decisiones con varios factores, errores difíciles | rastrea en el registro la causa raíz de esta fuga de memoria intermitente |

> DeepSeek documenta el parámetro de intensidad (`low` / `high` / `max`, además de `off` para desactivar el razonamiento), pero **nunca dice qué tipo de tarea corresponde a cada esfuerzo**. La tabla anterior es lo que sugiere el evaluador de DeepSeek por sí solo, sin intervención humana; cada ejemplo se ejecutó con el evaluador real.

## Coste

El complemento hace una evaluación y una actualización de la ficha por mensaje. La evaluación solo devuelve una palabra —off, low, high o max—, así que apenas consume tokens y tarda unos 0,7 s. La ficha está limitada a 120 caracteres, por lo que nunca crece con la conversación. La ficha se escribe en segundo plano después de la respuesta y nunca alarga tu espera.

| Por mensaje | Horas valle | Horas punta |
|---|---|---|
| Evaluación + ficha | unos `$0.0002` | unos `$0.0004` |

## Instalación

Tres formas; elige una.

**1. Deja que DSH lo instale**: envía esto en cualquier conversación:

```
Instala el complemento dsh-auto-effort
```

**2. Línea de comandos**:

```
plugin_manager install_bundle dsh-auto-effort
```

**3. Página de complementos**: abre **Complementos** en la barra lateral, busca `dsh-auto-effort` y haz clic en **Instalar**.

Una línea que empiece por `+ dsh-auto-effort` significa que ha funcionado.

**Después de instalar o actualizar el complemento, reinicia DSH.**

## Activarlo y desactivarlo

**Activado**

Se activa en el momento de instalarlo: una conversación nueva empieza a elegir el esfuerzo automáticamente de inmediato, y **una conversación que ya estuviera abierta empieza a funcionar cuando reinicias DSH.**

**Desactivado**

- Desactiva **Esfuerzo automático** en el menú del modelo: solo esta conversación.
- Elige cualquier esfuerzo a mano: esto también desactiva el modo automático en la conversación actual.
- Desactiva el complemento en su página: todas las conversaciones dejan de seleccionar automáticamente.

## Configuración

Normalmente no necesitas editar nada de esto. Todo lo siguiente sirve para ajustar y solucionar problemas, y los valores predeterminados encajan con casi todo el mundo.

| Campo | Predeterminado | Significado |
|---|---|---|
| `enabled` | `true` | interruptor principal; si está desactivado, no se carga la lógica de evaluación |
| `mode` | `auto` | valor predeterminado para conversaciones nuevas: `auto` evalúa cada mensaje y `manual` solo cede el control; el interruptor del menú cambia la conversación en la que estás |
| `levels` | `["off","low","high","max"]` | esfuerzos que puede usar el modo automático |
| `judgeModel` | `deepseek-flash` | modelo usado para evaluar; si está en blanco o es `model`, se evalúa con el modelo de esta misma conversación |
| `timeoutMs` | `3000` | tiempo de espera de la evaluación; si se agota, se usa el esfuerzo actual |
| `defaultLevel` | `null` | esfuerzo de reserva cuando falla la evaluación; `null` mantiene el esfuerzo actual |
| `requireMaxForUpgrade` | `false` | desactivado de forma predeterminada, para que el modo automático pueda elegir el nivel máximo `max`; si se activa, el modo automático se detiene en `high` y `max` queda solo en modo manual |
| `logFile` | `null` | ruta del registro; `null` significa `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | qué parte de la respuesta lee el generador de la ficha; menos es más barato, pero puede reducir la precisión |
| `cardMaxChars` | `120` | límite del propio texto de la ficha; menos es más barato, pero puede reducir la precisión |
| `debug` | `false` | registro detallado, incluida la salida sin procesar del evaluador |

## Enviar mientras se ejecuta un turno

**Ajustes → General → Enviar comportamiento mientras está ocupado** decide qué pasa con un mensaje que envías mientras aún se está escribiendo una respuesta:

- **Redirigir**: se une al turno en curso y conserva el esfuerzo de ese turno.
- **Cola**: se comporta exactamente como un mensaje normal.

## Si no pasa nada

1. Comprueba que el complemento esté **activado** en su página (**Complementos → Complementos instalados**).
2. Si la conversación ya existía cuando lo instalaste, reinicia DSH una vez.
3. Comprueba que **Esfuerzo automático** siga activado en el menú del modelo: elegir un esfuerzo a mano solo lo desactiva en esta conversación.
4. Consulta el registro en `~/.dsh/auto-effort.log`: cada mensaje escribe una línea `turn N judging …`.
5. Si un turno sufre un error de API o la evaluación falla tres veces seguidas, el complemento pausa esta conversación y una barra sobre el cuadro de entrada te explica por qué. Pulsa **Volver a activarlo** en esa barra o desactiva y vuelve a activar el interruptor: no hace falta reiniciar.

## Desinstalación

**Complementos → Complementos instalados → dsh-auto-effort → Desinstalar.** La evaluación se detiene y la configuración que añadió se elimina.

## Desarrollo

- Código fuente: `index.js` (la mitad del host), `client.js` (el interruptor del menú del modelo y el aviso de pausa), `judge.js` (las dos llamadas al evaluador), `config.js` (validación sin dependencias), `schema.js` (esquema de configuración), `stats.js` y `server.js` (el contador local de coste y el interruptor por conversación que hay detrás de las cifras).
- Instalar desde un directorio local (`install_bundle <dir>`) es una vía para desarrolladores; los usuarios normales nunca lo hacen así; haz una copia de seguridad del directorio antes de quitar el complemento.
- `npm test` ejecuta tres suites sin conexión: configuración/parseo/tiempo de espera, el cableado de la toma de control y del interruptor por conversación (incluido el estado del aviso de pausa) y el sidecar de loopback.
