<p align="center">
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.md">English</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.zh.md">简体中文</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ja.md">日本語</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.es.md">Español</a> ·
  <b>Français</b> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.de.md">Deutsch</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.ru.md">Русский</a> ·
  <a href="https://github.com/xsarthur90-art/dsh-auto-effort/blob/main/README.pt.md">Português</a>
</p>

# dsh-auto-effort · Effort automatique

Arrêtez de choisir un effort. Installez-le une fois et **DeepSeek le choisit pour chaque message**.

## Moins cher, plus rapide, plus détendu — coût visible, basculez à tout moment

![Le menu du modèle avec la ligne Effort automatique](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/menu-fr.png)

- **Moins cher** : choisir un effort à la main revient souvent à se tromper — trop bas, il faut refaire le travail et dépenser plus ; trop haut, cela consomme des tokens. L'automatique ne coûte qu'environ `$0.0002` de plus par message aux heures creuses, environ `$0.0004` aux heures de pointe.
- **Plus rapide** : choisir à la main demande deux clics et 2–3 s ; un choix trop bas oblige à refaire le travail, un choix trop haut gaspille du temps de raisonnement. L'automatique n'ajoute qu'environ **0,7 s** par message.
- **Plus détendu** : plus besoin de peser « low ou max » pour chaque message, ni de se dire « zut, mauvais effort ». Dites simplement ce que vous voulez ; l'effort suit. **Zéro angoisse !**
- **Coût visible** : la ligne du menu affiche les exécutions, le coût et le temps d'évaluation de cette conversation, et la page du plugin tient un total cumulé.
- **Basculez à tout moment** : désactivez-le quand vous n'en voulez pas, activez-le quand vous en avez besoin.

![La page du plugin, avec les totaux cumulés](https://cdn.jsdelivr.net/npm/dsh-auto-effort@0.2.5/docs/plugin-page-fr.png)

## Comment il décide

Le plugin s'appuie sur le dernier modèle DeepSeek. Il résume la conversation et conserve en arrière-plan une fiche de 120 caractères maximum. Chaque fois que vous envoyez un message, il lit ce message et la fiche, puis choisit l'un des quatre efforts. La fiche consigne ce que fait la conversation et ce qu'il reste à faire : ainsi, « ok, vas-y » est évalué d'après le travail en attente, et non d'après sa propre longueur.

| Effort | Pour quoi DeepSeek le choisit | Exemple mesuré |
|---|---|---|
| `off` | discussion, confirmations, recherches, modifications de configuration, exécution de commandes | lister le répertoire courant |
| `low` | petites modifications, renommages, rangement, application d'un schéma connu | renommer ces variables de façon cohérente |
| `high` | analyse, débogage, explication de cause, code non trivial | aide-moi à comprendre pourquoi cette approche est lente |
| `max` | architecture, comparaison d'options, arbitrages multi-critères, bugs difficiles | remonter à la cause racine de cette fuite mémoire intermittente dans les journaux |

> DeepSeek documente le paramètre de force (`low` / `high` / `max`, plus `off` pour désactiver la réflexion) mais **ne dit jamais quel type de tâche correspond à quel effort**. Le tableau ci-dessus est ce que le juge DeepSeek propose de lui-même, sans intervention humaine ; chaque exemple a été testé sur le vrai juge.

## Coût

Le plugin effectue une évaluation et une mise à jour de la fiche par message. L'évaluation ne répond jamais qu'un seul mot — off, low, high ou max — elle ne coûte donc presque aucun token et prend environ 0,7 s. La fiche est limitée à 120 caractères et ne s'allonge donc jamais avec la conversation. Elle est écrite en arrière-plan après la réponse et n'allonge jamais votre attente.

| Par message | Heures creuses | Heures de pointe |
|---|---|---|
| Évaluation + fiche | environ `$0.0002` | environ `$0.0004` |

## Installation

Trois façons, choisissez-en une.

**1. Laissez DSH l'installer** — envoyez ceci dans n'importe quelle conversation :

```
Installez le plugin dsh-auto-effort
```

**2. Ligne de commande** :

```
plugin_manager install_bundle dsh-auto-effort
```

**3. Page des plugins** — ouvrez **Plugins** dans la barre latérale, recherchez `dsh-auto-effort`, cliquez sur **Installer**.

Une ligne commençant par `+ dsh-auto-effort` signifie que c'est réussi.

**Après avoir installé ou mis à jour le plugin, redémarrez DSH.**

## L'activer et le désactiver

**Activé**

Il est actif dès son installation : une nouvelle conversation sélectionne automatiquement l'effort immédiatement, et **une conversation déjà ouverte ne commence qu'après un redémarrage de DSH.**

**Désactivé**

- Désactivez **Effort automatique** dans le menu du modèle : cette conversation uniquement.
- Choisissez un effort à la main : cela désactive aussi l'automatique dans la conversation en cours.
- Désactivez le plugin sur la page des plugins : toutes les conversations cessent la sélection automatique.

## Configuration

Vous n'avez normalement rien à modifier ici. Tout ce qui suit sert au réglage fin et au dépannage, et les valeurs par défaut conviennent à presque tout le monde.

| Champ | Valeur par défaut | Signification |
|---|---|---|
| `enabled` | `true` | interrupteur principal ; désactivé, aucune logique d'évaluation n'est chargée |
| `mode` | `auto` | valeur par défaut des nouvelles conversations : `auto` évalue chaque message, `manual` laisse simplement la main ; l'interrupteur du menu modifie la conversation en cours |
| `levels` | `["off","low","high","max"]` | efforts que le mode automatique peut utiliser |
| `judgeModel` | `deepseek-flash` | modèle utilisé pour l'évaluation ; vide ou `model` évalue avec le modèle de cette conversation |
| `timeoutMs` | `3000` | délai d'attente de l'évaluation ; en cas de dépassement, l'effort en cours est utilisé |
| `defaultLevel` | `null` | effort de repli si l'évaluation échoue ; `null` conserve l'effort en cours |
| `requireMaxForUpgrade` | `false` | désactivé par défaut, l'automatique peut donc choisir le niveau le plus élevé `max` ; activé, l'automatique s'arrête à `high` et `max` reste manuel |
| `logFile` | `null` | chemin du journal ; `null` signifie `~/.dsh/auto-effort.log` |
| `cardInputChars` | `600` | part de la réponse lue par le rédacteur de la fiche ; plus petite = moins cher, mais la précision peut baisser |
| `cardMaxChars` | `120` | limite du texte de la fiche ; plus petite = moins cher, mais la précision peut baisser |
| `debug` | `false` | journalisation détaillée, y compris la sortie brute du juge |

## Envoyer pendant qu'un tour est en cours

**Paramètres → Général → Comportement d'envoi lorsque vous êtes occupé** détermine ce qu'il advient d'un message envoyé pendant qu'une réponse est encore en cours de rédaction :

- **Guider** — il rejoint le tour en cours et conserve l'effort de ce tour.
- **File d'attente** — il se comporte exactement comme un message normal.

## Si rien ne se passe

1. Vérifiez que le plugin est **activé** sur la page des plugins (**Plugins → Plugins installés**).
2. Si la conversation existait déjà lors de l'installation, redémarrez DSH une fois.
3. Vérifiez que **Effort automatique** est toujours activé dans le menu du modèle — choisir un effort à la main le désactive dans cette conversation uniquement.
4. Lisez le journal `~/.dsh/auto-effort.log` — chaque message y écrit une ligne `turn N judging …`.
5. Si un tour a rencontré une erreur d'API, ou si l'évaluation a échoué trois fois de suite, le plugin met cette conversation en pause et une barre au-dessus de la zone de saisie vous explique pourquoi. Appuyez sur **Réactiver** dans cette barre, ou désactivez puis réactivez l'interrupteur — aucun redémarrage n'est nécessaire.

## Désinstallation

**Plugins → Plugins installés → dsh-auto-effort → Désinstaller.** L'évaluation s'arrête ; la configuration ajoutée par le plugin est nettoyée.

## Développement

- Code source : `index.js` (partie hôte), `client.js` (l'interrupteur du menu du modèle et la bannière de pause), `judge.js` (les deux appels au juge), `config.js` (validation sans dépendance), `schema.js` (schéma de configuration), `stats.js` et `server.js` (le compteur de coût local et l'interrupteur par conversation derrière les chiffres).
- L'installation depuis un répertoire local (`install_bundle <dir>`) est réservée aux développeurs — les utilisateurs ordinaires ne passent jamais par là ; sauvegardez le répertoire avant de retirer le plugin.
- `npm test` exécute trois suites hors ligne : configuration/analyse/délai d'attente, le câblage de la reprise en main et de l'interrupteur par conversation (y compris l'état de la bannière de pause), et le sidecar en boucle locale.
