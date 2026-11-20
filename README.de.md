<p align="center">
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.md">English</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.zh.md">简体中文</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ja.md">日本語</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.es.md">Español</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.fr.md">Français</a> ·
  <b>Deutsch</b> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ru.md">Русский</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.pt.md">Português</a>
</p>

# dsh-auto-effort · Aufwand automatisch wählen

Schluss mit dem Auswählen des Aufwands. Einmal installieren, und **DeepSeek wählt ihn für jede Nachricht**.

Etwas kaputt? [Issue öffnen](https://github.com/xsarthur90-art/dsh-auto-effort/issues/new/choose) — bitte mit Plugin-Version und den letzten Zeilen aus `~/.dsh/auto-effort.log`.

## Günstiger, schneller, entspannter — Kosten im Blick, jederzeit umschalten

![Das Modellmenü mit der Zeile „Aufwand automatisch wählen“](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/menu-de.png)

- **Günstiger**: Den Aufwand von Hand zu wählen heißt meistens, falsch zu wählen — zu niedrig bedeutet Nacharbeit und mehr Kosten, zu hoch verbrennt Tokens. Automatisch kostet pro Nachricht außerhalb der Stoßzeiten nur etwa `$0.0002` extra, zu Stoßzeiten etwa `$0.0004`.
- **Schneller**: Die Wahl von Hand dauert zwei Klicks und 2–3 s; eine zu niedrige Wahl bedeutet, die Arbeit noch einmal zu machen, eine zu hohe verschwendet Denkzeit. Automatisch kostet nur etwa **0,7 s** pro Nachricht.
- **Entspannter**: kein Abwägen mehr zwischen „low oder max“ bei jeder Nachricht und kein „Ups, falscher Aufwand“ mehr. Sagen Sie einfach, was Sie wollen; der Aufwand folgt. **Keine Nervosität!**
- **Kosten im Blick**: Die Menüzeile zeigt die Durchläufe dieser Unterhaltung, die Kosten und die Beurteilungszeit; die Plugin-Seite führt eine laufende Summe.
- **Jederzeit umschaltbar**: Schalten Sie es aus, wann immer Sie es nicht brauchen, und wieder ein, wenn Sie es brauchen.

![Die Plugin-Seite mit den laufenden Summen](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/plugin-page-de.png)

## Wie es urteilt

Das Plugin dockt an das neueste DeepSeek-Modell an. Es fasst die Unterhaltung zusammen und hält im Hintergrund eine Karte mit höchstens 120 Zeichen bereit. Jedes Mal, wenn Sie eine Nachricht senden, liest es diese Nachricht plus die Karte und wählt dann einen der vier Aufwände. Die Karte hält fest, was die Unterhaltung gerade tut und was noch offen ist, sodass „ok, mach weiter“ anhand der ausstehenden Arbeit beurteilt wird und nicht anhand seiner eigenen Länge.

| Aufwand | Wofür DeepSeek ihn wählt | Gemessenes Beispiel |
|---|---|---|
| `off` | Chat, Bestätigungen, Nachschlagen, Konfiguration bearbeiten, Befehle ausführen | das aktuelle Verzeichnis auflisten |
| `low` | kleine Änderungen, Umbenennungen, Aufräumen, ein bekanntes Muster anwenden | diese Variablen einheitlich umbenennen |
| `high` | Analyse, Fehlersuche, Erklären von Ursachen, nicht trivialer Code | hilf mir herauszufinden, warum dieser Ansatz langsam ist |
| `max` | Architektur, Abwägen von Optionen, Mehrfaktor-Abwägungen, schwierige Fehler | dieses sporadische Speicherleck in den Logs bis zur Ursache zurückverfolgen |

> DeepSeek dokumentiert den Stärkeparameter (`low` / `high` / `max`, plus `off` für ausgeschaltetes Denken), sagt aber **nie, welche Art von Aufgabe zu welchem Aufwand gehört**. Die obige Tabelle ist das, was der DeepSeek-Judge von sich aus vorschlägt, ohne menschliche Vorgabe; jedes Beispiel wurde mit dem echten Judge ausgeführt.

## Kosten

Das Plugin führt pro Nachricht eine Beurteilung und eine Kartenaktualisierung durch. Die Beurteilung antwortet immer nur mit einem Wort — off, low, high oder max — und kostet daher kaum Tokens; sie dauert etwa 0,7 s. Die Karte ist auf 120 Zeichen begrenzt und wächst daher nie mit der Unterhaltung. Die Karte wird nach der Antwort im Hintergrund geschrieben und verlängert Ihre Wartezeit nie.

| Pro Nachricht | Außerhalb der Stoßzeiten | Stoßzeiten |
|---|---|---|
| Beurteilung + Karte | etwa `$0.0002` | etwa `$0.0004` |

## Installation

Drei Wege, wählen Sie einen.

**1. DSH installiert es** — senden Sie dies in einer beliebigen Unterhaltung:

```
Installiere das Plugin dsh-auto-effort
```

**2. Terminal** — mit installierter DSH-CLI:

```
dsh plugin --profile web add dsh-auto-effort
```

**3. Plugin-Seite** — öffnen Sie **Plugins** in der Seitenleiste, suchen Sie `dsh-auto-effort`, und klicken Sie auf **Installieren**.

Eine Zeile, die mit `+ dsh-auto-effort` beginnt, bedeutet, dass es funktioniert hat.

**Starten Sie DSH nach dem Installieren oder Aktualisieren des Plugins neu.**

Wenn Sie vor dem Aktualisieren wissen möchten, was sich ändert, sehen Sie in [CHANGELOG.md](https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/CHANGELOG.md) nach.

## Ein- und Ausschalten

**An**

Es ist ab dem Moment der Installation an: Eine neue Unterhaltung beginnt sofort mit der automatischen Auswahl, und **eine bereits geöffnete Unterhaltung startet erst, wenn Sie DSH neu starten.**

**Aus**

- Schalten Sie **Aufwand automatisch wählen** im Modellmenü aus: nur diese Unterhaltung.
- Wählen Sie einen Aufwand von Hand: Dadurch wird die Automatik in der aktuellen Unterhaltung ebenfalls ausgeschaltet.
- Schalten Sie das Plugin auf der Plugin-Seite aus: In allen Unterhaltungen wird die automatische Auswahl beendet.

## Konfiguration

Normalerweise müssen Sie nichts davon bearbeiten. Alles Folgende dient dem Feintuning und der Fehlersuche; die Standardwerte passen für fast alle.

| Feld | Standard | Bedeutung |
|---|---|---|
| `enabled` | `true` | Hauptschalter; aus bedeutet, dass keine Beurteilungslogik geladen wird |
| `mode` | `auto` | der Standard für neue Unterhaltungen: `auto` beurteilt jede Nachricht, `manual` übergibt nur; der Schalter im Menü ändert die Unterhaltung, in der Sie sich befinden |
| `levels` | `["off","low","high","max"]` | Aufwände, die der Automatikmodus verwenden darf |
| `judgeModel` | `deepseek-flash` | Modell für die Beurteilung; leer oder `model` beurteilt mit dem Modell dieser Unterhaltung |
| `timeoutMs` | `3000` | Zeitlimit für die Beurteilung; bei Zeitüberschreitung wird der aktuelle Aufwand verwendet |
| `defaultLevel` | `null` | Ersatzaufwand, wenn die Beurteilung fehlschlägt; `null` bedeutet, der aktuelle Aufwand bleibt erhalten |
| `requireMaxForUpgrade` | `false` | standardmäßig aus, sodass die Automatik die oberste Stufe `max` wählen kann; wenn eingeschaltet, stoppt die Automatik bei `high` und `max` ist nur manuell möglich |
| `logFile` | `null` | Protokollpfad; `null` bedeutet `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | wie viel der Antwort für die Karte gelesen wird; weniger ist günstiger, kann aber die Genauigkeit senken |
| `cardMaxChars` | `120` | Obergrenze für den Kartentext selbst; weniger ist günstiger, kann aber die Genauigkeit senken |
| `debug` | `false` | ausführliche Protokollierung, einschließlich der Rohausgabe des Judges |

## Senden, während ein Durchlauf läuft

**Einstellungen → Allgemein → Sendeverhalten, während beschäftigt ist** entscheidet, was mit einer Nachricht geschieht, die Sie senden, während noch eine Antwort geschrieben wird:

- **Lenken** — sie schließt sich dem laufenden Durchlauf an und behält dessen Aufwand.
- **Warteschlange** — sie verhält sich genau wie eine normale Nachricht.

## Wenn nichts passiert

1. Prüfen Sie, ob das Plugin auf der Plugin-Seite **aktiviert** ist (**Plugins → Installierte Plugins**).
2. Wenn die Unterhaltung bereits existierte, als Sie es installiert haben, starten Sie DSH einmal neu.
3. Prüfen Sie, ob **Aufwand automatisch wählen** im Modellmenü noch an ist — das manuelle Wählen eines Aufwands schaltet sie nur in dieser Unterhaltung aus.
4. Lesen Sie das Protokoll unter `~/.dsh/auto-effort.log` — jede Nachricht schreibt eine Zeile `turn N judging …`.
5. Wenn ein Durchlauf einen API-Fehler hatte oder die Beurteilung dreimal hintereinander fehlgeschlagen ist, pausiert das Plugin diese Unterhaltung, und eine Leiste über dem Eingabefeld nennt den Grund. Drücken Sie **Turn it back on** in dieser Leiste, oder schalten Sie den Schalter aus und wieder ein — ein Neustart ist nicht nötig.

## Deinstallieren

**Plugins → Installierte Plugins → dsh-auto-effort → Deinstallieren.** Die Beurteilung stoppt; die hinzugefügte Konfiguration wird entfernt.

## Entwicklung

- Quelle: `index.js` (Host-Hälfte), `client.js` (der Schalter im Modellmenü und das Pausen-Banner), `judge.js` (die beiden Judge-Aufrufe), `config.js` (abhängigkeitsfreie Validierung), `schema.js` (Konfigurationsschema), `stats.js` und `server.js` (der lokale Kostenzähler und der Schalter pro Unterhaltung hinter den Zahlen).
- Die Installation aus einem lokalen Verzeichnis (`install_bundle <dir>`) ist ein Entwicklerweg — normale Nutzer installieren nie so; sichern Sie das Verzeichnis, bevor Sie das Plugin entfernen.
- `npm test` führt drei Offline-Suiten aus: Konfiguration/Parsen/Zeitlimit, die Verdrahtung der Übernahme und des Schalters pro Unterhaltung (einschließlich des Status des Pausen-Banners) und den Loopback-Sidecar.
