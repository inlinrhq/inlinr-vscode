# Règles communes, appliquées à inlinr-vscode

Repris de 7IBO/socle au commit c05cb7c, le 26/11 (copie précédente au
commit f0e3f9d, le 24/11).

Ce dépôt vit seul : ce fichier et le [CLAUDE.md](../CLAUDE.md) suffisent pour
y travailler, il n'y a rien à lire ailleurs, et le CLAUDE.md gagne en cas
d'écart. Ce sont les règles que Thibault tient pour toutes ses apps, adaptées
ici ; une règle commune qui change arrive par une PR à elle. Ce qui ne peut
pas valoir pour une extension d'éditeur n'est pas repris : interface d'un
site, design, accessibilité, perfs web, SEO, serveur partagé. Chat en
français ; commits, PR, code, commentaires, README, CHANGELOG et textes de
l'extension en anglais.

## Règles qui ne se discutent pas

1. **Aucune attribution à Claude ni à Anthropic** : ni `Co-Authored-By`, ni
   `Claude-Session`, ni « Generated with », ni lien de session, ni bloc
   « Requested by », dans les commits, les PR, les commentaires GitHub, les
   noms de branches et les fichiers. Jamais de branche `claude/…`. Le corps de
   chaque PR se relit juste après sa création : l'outil y ajoute un pied,
   qu'on retire avant de la rendre.
2. **Aucun secret dans le dépôt ni en mémoire** : on écrit le nom d'une clé et
   l'endroit où elle vit, jamais sa valeur.
3. **Rien d'irréversible sans le mot de Thibault** : suppression en masse,
   message envoyé hors du projet, et ce qui touche à la production. Ici, la
   production est ce que les éditeurs installent : sans son mot, une version
   publiée ne se retire pas d'une place de marché, et un tag ou une release
   ne se suppriment ni ne se réécrivent.
4. **Chaque choix se remet en question** avant d'être codé (plus bas), puis
   Claude tranche seul et dit ce qu'il a décidé.
5. **Pas d'avocat ni de comptable** : une question juridique ou fiscale se
   vérifie avec sa source primaire, marquée [A] lue, [B] résumé, [C] connue
   non relue, et un risque résiduel en une phrase.

## Git

- Identité de commit : `Thibault <71017357+7IBO@users.noreply.github.com>`. Un
  conteneur cloud signe « Claude » par défaut : le hook `SessionStart` de
  `.claude/settings.json` règle l'identité et copie `.githooks/` dans
  `.git/hooks/`, dans le cloud seulement. Sur un PC, une fois par clone : les
  deux `git config`, puis `cp .githooks/* .git/hooks/`. Les squash faits par
  GitHub prennent l'adresse du compte : tant que « Keep my email addresses
  private » n'est pas coché dans les réglages GitHub de Thibault (son geste),
  ils portent son adresse Gmail. Relevé du 24/11 : c'est le cas de tous les
  derniers commits de `main` de ce dépôt public ; ceux des PR portent bien la
  noreply.
- `.githooks/commit-msg` refuse une ligne d'attribution dans un message ;
  l'étape « No attribution » de la CI relit les commits de la PR et refuse une
  branche `claude/`, mais ne lit ni le titre ni le corps de la PR (écart
  au 24/11 : emblem.run et Koleko les lisent quand la PR passe prête).
  `.githooks/pre-push` refuse un push direct sur `main` (garde local, pas une
  protection de GitHub).
- Une branche par ticket : le `gitBranchName` de Linear, sans le changer (on
  renomme le ticket avant), partie du dernier `origin/main`. Jamais de push
  forcé sur `main`, jamais de réécriture d'une branche partagée.
- Une branche fusionnée est supprimée : « Automatically delete head
  branches » coché dans les réglages du dépôt, un geste de Thibault. Relevé
  du 24/11 : 46 branches fusionnées restaient dans les cinq dépôts d'Inlinr.
- Commits en Conventional Commits, en anglais : `type(scope): summary`
  (impératif, minuscules, sans point, 72 caractères au plus), le pourquoi en
  dessous, puis `Refs: THI-NN`. Types : feat, fix, perf, refactor, docs, test,
  build, ci, chore, revert, style ; `!` pour un changement cassant.
- L'id d'un ticket vit dans Linear, la branche, la PR et le message de commit ;
  jamais dans le code, un commentaire, un nom, un test, la doc ou un chemin :
  le pourquoi s'écrit en mots. Aucun contrôle ne le tient ici, il se vérifie
  en relecture.

## Pull requests

1. Ticket Linear prêt : problème, pour qui, proposition, « fait quand »
   vérifiable, mesure après sortie, ce qu'il faudra publier.
2. Branche, PR **en brouillon** dès le premier push : le travail et les
   relectures s'y font. Elle passe prête **une seule fois**, à la fin.
3. Les contrôles de `ci.yml` passent dans la session avant chaque push :
   `bunx tsc --noEmit`, `bun run test`, `bun run build`,
   `bunx @biomejs/biome@2.5.6 ci .`.
4. Deux relectures indépendantes (plus bas), chaque remarque corrigée ou
   répondue dans le corps. Une seule suffit pour une PR de moins de 200 lignes
   changées qui ne touche ni à la sécurité ni à ce qui quitte la machine, et
   pour une PR de docs seules.
5. Merge en squash quand la CI est verte, sans conflit ni remarque ouverte,
   sous une seule forme : en titre, celui de la PR suivi de son numéro
   (`type(scope): summary (THI-NN) (#N)`) ; en message, son Summary en
   quelques lignes, puis `Refs: THI-NN` (une PR sans ticket garde le titre et
   le numéro, sans cette ligne). Jamais le message par défaut de GitHub ni de
   trailer. Une PR dont la base a bougé depuis sa dernière CI est mise à
   jour avant. Ticket en Done ; ce qui reste à publier est écrit.
6. Un fil qui s'arrête laisse une note de passation en commentaire du ticket
   (fait, reste, prochaine action, qui la porte).

Titre : `type(scope): summary (THI-NN)`, en anglais, 100 caractères au plus
hors le numéro de PR que le squash ajoute ; il devient le commit sur `main`.
Corps : [.github/pull_request_template.md](../.github/pull_request_template.md).
Verification dit ce qui a tourné, ce que ça a donné et ce que les relectures
ont changé. Deployment dit « none », ou la release : la version de
`package.json` et l'ordre avec les autres dépôts. Le corps se corrige avec
l'outil MCP `update_pull_request` : un PATCH par `gh api` remet le pied
d'attribution.

`main` est protégée là où un merge livre : PR obligatoire, squash seul,
contrôle de CI requis (modèle : `.github/rulesets/main.json` de Koleko).
Au 24/11, ce dépôt ne l'a pas,
alors qu'un merge qui change la version publie.
Les réglages du dépôt prennent le titre et le message de squash de la PR,
suppriment la branche au merge et coupent le commit de fusion et le rebase.
Ce sont des réglages de Thibault : une session ne les change pas elle-même.

## Relecture

Les relecteurs sont les agents de `.claude/agents/` : ils n'ont pas écrit le
changement et reçoivent le numéro de PR, le ticket et le diff, **jamais le
récit de l'auteur**. Quand un seul suffit, c'est le premier de la ligne.

| La PR touche | Relecteurs |
|---|---|
| Suivi des événements, attribution des modifications, lancement de la CLI, lecture de git, barre d'état | code, deux fois : justesse et cas limites, puis charge (travail à chaque frappe, lancements de la CLI, taille du tampon) |
| Workflows, téléchargement et vérification de la CLI, signalement d'erreurs, ce qui quitte la machine | code + ops |
| Docs ou outillage seuls | code, une fois (étape 4 du cycle) : les faits et commandes, et l'effet sur les autres règles |

- **Code** : justesse (vide, null, cas limites, plusieurs fenêtres ouvertes
  en même temps, un fork de VS Code) ; rien de gardé ni d'envoyé sans borne ;
  sécurité (argument passé à la CLI, jeton ou chemin personnel dans le canal
  de sortie ou un signalement) ; coût (travail à chaque frappe, lancements de
  la CLI) ; le contrat avec la CLI et le serveur.
- **Ops** : l'ordre de sortie (la CLI d'abord), le retour arrière, les jetons
  de publication et les actions épinglées de `release.yml`, la vérification
  de la CLI téléchargée, ce qu'une version fait chez chaque utilisateur.

Les remarques vont dans la section Reviews du corps (rôle, commit lu, la plus
grave d'abord, chacune avec sa réponse : corrigée, avec le commit, ou pourquoi
pas), jamais en commentaire GitHub : l'outil y ajoute une ligne d'attribution
qu'on ne peut pas retirer. Après les corrections, un relecteur vérifie les
corrections seules.

**Refusent une PR** : un secret, un id de ticket dans le code, une attribution
à une IA ; un drapeau passé à la CLI ou un champ du contrat changé sans le
changement correspondant dans les autres dépôts ni ordre de sortie écrit ; une
donnée nouvelle qui quitte la machine sans que le README le dise (« Privacy »),
ou un service nouveau qui reçoit des données personnelles sans être nommé dans
la politique de confidentialité d'inlinr.com ; un contrôle contourné (règle
désactivée, test sauté).

## Remettre en question chaque choix

Avant de coder une commande, un réglage, une dépendance, un appel à un service
ou un changement d'architecture, écrire en quelques lignes : qui s'en sert et
comment on le sait (une fonction que personne n'utilise se retire plutôt que
de s'améliorer) ; ce que ça coûte (travail à chaque frappe, lancements de la
CLI, maintenance sur VS Code et ses forks) ; la version la plus simple qui
rend le même service, et pourquoi elle ne suffit pas ; les cas (vide, énorme,
concurrent, hors ligne, quelqu'un qui n'est pas l'utilisateur) ; ce qui est
vérifié et ce qui est supposé.

Un petit correctif de bug reste direct. Un ticket se relit avant d'être codé :
s'il est faux, déjà fait ou inutile, on le dit et on le ferme. Une remarque de
relecteur se vérifie, ce n'est pas un ordre.

## Qualité du code

- TypeScript strict ; pas de `any` sans commentaire qui dit pourquoi. Biome
  formate et vérifie en CI, on ne se bat pas contre lui. Une règle qui revient
  en relecture devient un contrôle, pas une phrase de plus dans le CLAUDE.md.
- Un fichier : 600 lignes au plus (un test 1 000), sinon on le découpe. Un
  bloc de 10 lignes ou plus présent à deux endroits devient une fonction
  partagée. Un export sans appelant se retire. Aucun contrôle ne tient ces
  trois points : ils se vérifient en relecture.
- Un module par sujet dans `src/`, son test à côté.
- Dépendances à leur dernière version stable, vérifiées une fois par mois et
  tout de suite pour une faille. Pas de bot de mise à jour.
  Écart au 24/11 : aucune passe mensuelle datée ici, et la skill `deps` du
  socle n'est pas encore copiée ; la prochaine passe se date dans sa PR.
- Un commentaire dit **pourquoi**, en anglais, jamais ce que le code dit déjà :
  12 lignes au plus par bloc, ni id de ticket ni numéro de PR. Un commentaire
  faux se corrige dans la PR qui change le code.
- Un refactor est sa propre PR (`refactor(scope): …`), sans changement de
  comportement, avec les tests qui le prouvent.
- Une règle ou un contrat qui change met à jour, dans la même PR, le CLAUDE.md
  et le README (commandes, réglages, « Privacy »), puis la section du contrat
  des autres dépôts, par une PR dans chacun.

## Textes

La même règle pour le README, le CHANGELOG, les textes de l'extension
(commandes, barre d'état, messages), les commits, les PR et les tickets. Des
phrases simples, comme un développeur l'expliquerait à un autre. Pas de tiret
long ni de tiret de pause : une virgule, deux-points, un point ou des
parenthèses (un tiret court seulement entre deux nombres). Ni adverbe de
remplissage (`really`, `simply`), ni mot creux (`seamless`, `leverage`), ni
emoji, ni point d'exclamation, ni formule de machine. Titres en casse de
phrase. Une promesse se dit une fois et se vérifie dans le code : ce que le
README dit envoyer ou ne jamais envoyer est ce que l'extension fait. Aucun
contrôle ne tient ces règles ici : elles se vérifient en relecture.

## CI et releases

- Le dépôt est public : ses minutes GitHub Actions ne sont pas comptées dans
  le budget de l'organisation (3 000 par mois, pour inlinr-web).
- La CI (`ci.yml`) tourne sur les PR seulement, en un seul job, jamais sur un
  push vers `main` : `main` n'est vérifié que par la PR. Elle tourne à chaque
  push sur une PR, brouillon compris (ni filtre sur les brouillons ni
  `timeout-minutes`). Aucune tâche planifiée dans GitHub Actions.
- Chaque job a un `timeout-minutes`, pour qu'un test bloqué ne brûle pas
  les 6 heures par défaut : écart au 24/11 : absent de `ci.yml` comme de
  `release.yml`.
- Un job qui tient un jeton de publication fige ses outils : les actions
  par leur commit, la version de bun ou de Go, les outils de publication par
  le lockfile. Écart au 24/11 : `release.yml`,
  qui tient les jetons des deux places de marché, prend `bun-version:
  latest` (`ci.yml` aussi, mais il ne tient aucun jeton).
- Une release part quand un merge sur `main` change la `version` de
  `package.json` pour une version sans tag : `release.yml` construit le
  `.vsix`, le publie sur le VS Code Marketplace et sur OpenVSX (pour Cursor et
  Windsurf), puis crée le tag et la GitHub Release. Rien n'est signé. Une PR
  qui ne veut pas publier ne touche pas à `version`.
- Une version publiée ne se rappelle pas : les éditeurs mettent l'extension à
  jour seuls. Le retour arrière est une version de plus (un revert mergé, avec
  un numéro au-dessus). Jamais une release pour « voir » un changement
  (`bun run build` puis `bunx vsce package --no-dependencies` donnent le
  `.vsix`) ; deux par jour au plus, la seconde pour un correctif.
- L'ordre entre les dépôts : la CLI sort avant l'extension qui lui passe un
  drapeau nouveau (`heartbeat` sort en 2 sur un drapeau inconnu, et les beats
  attendent en mémoire) ; inlinr-web avant les deux pour un champ nouveau.
- Après une release : les deux places de marché indexent en différé, on les
  interroge avant de dire une version en ligne (CLAUDE.md, « Marketplaces »).

## Appels au réseau et erreurs

L'extension n'envoie aucun beat : la CLI porte le jeton et le réseau. Elle
n'appelle le réseau qu'à trois endroits : `dependencies.ts` (la CLI, depuis
GitHub), `today.ts` (le total du jour) et `report.ts` (ses propres échecs).

- **Un délai à chaque appel**, dans les options du fetch
  (`signal: AbortSignal.timeout(ms)`, comme `report.ts`), jamais dans un
  `new Request`. Écart au 24/11 : `fetchBuf` (`dependencies.ts`) et
  `fetchToday` (`today.ts`) appellent sans délai.
- **On ne relance que ce qui peut passer** : un lot que la CLI n'a pas pris
  reste en mémoire (2 000 beats au plus) et repart au vidage suivant ; il est
  perdu si l'éditeur ferme avant. Un signalement d'erreur ne se relance pas.
- **Le serveur n'est pas chargé plus que prévu** : les deux constantes du
  CLAUDE.md (un beat par fichier toutes les 2 min, un vidage toutes les 30 s)
  ne changent qu'avec un test côté serveur.
- **Ce qui manque coupe la fonction sans rien casser** : sans jeton, la barre
  d'état n'a pas de total ; une mise à jour de la CLI qui échoue va dans le
  canal de sortie « inlinr », sans fenêtre.
- **Ce qui est stocké survit au code qui l'a écrit** : `~/.inlinr/config.toml`
  est écrit par la CLI et le plugin Claude Code, et lu ici (jeton, pause) ; la
  CLI se met à jour seule, donc l'extension parle à une CLI plus vieille ou
  plus neuve qu'elle. Un réglage nouveau s'écrit aussi dans le README.
- **Une erreur arrive à un endroit que quelqu'un lit** : `report.ts` envoie à
  Admin → Errors d'inlinr.com ce que la CLI ne peut pas signaler elle-même, le
  dossier personnel remplacé par `~`, la même erreur une fois par jour au
  plus, rien quand la télémétrie de VS Code est coupée. Un log ne cite jamais
  le jeton.

## Clés et fuites

- `VSCE_PAT` (jeton Azure DevOps, droit Marketplace > Manage) et `OVSX_PAT`
  (jeton OpenVSX, droit `publish`) sont des secrets GitHub Actions du dépôt,
  lus par `release.yml` seul, avec une expiration d'un an au plus quand le
  service la propose.
- `src/release-key.ts` porte la clé publique des releases de la CLI, la même
  que celle d'inlinr-cli. Elle change avec elle : une CLI et une extension qui
  portent la nouvelle clé sortent avant la première release signée avec.
- Le jeton d'un appareil (`in_d_…`) vit dans `~/.inlinr/config.toml`, écrit
  par la CLI ; l'extension le lit pour la barre d'état. Un fichier de secrets
  n'est jamais lu par une IA, quel que soit l'outil (Read, `cat`, `grep`) : un
  `.env`, une clé privée, le `config.toml` d'une vraie machine.
- Une clé par usage, avec le droit le plus petit qui suffit. Rotation tout de
  suite quand elle a pu fuiter (affichée dans un journal, une capture, un fil,
  un commit même effacé), partout où elle vit ; l'ancienne est révoquée après.
  Puis lire les journaux du service et écrire ce qui s'est passé dans le ticket.

## Linear

- Équipe THI, projet Inlinr. **Ce qu'est un ticket** : un travail à faire
  dans le mois, ou un geste de Thibault. Une idée pour plus tard va dans le
  document « Réserve » du projet Linear, en une ligne datée ; elle redevient
  un ticket le jour où on la prend. Un contrôle qui revient est une tâche
  planifiée, pas un ticket ; pas de ticket chapeau qui ne fait que lister
  d'autres tickets.
- Un ticket : titre en français à l'infinitif, 1 à 4 puces. Labels : un seul
  de type (Feature, Improvement, Bug), au besoin un de domaine (Marketing,
  Légal, Ops, SEO, UI) ; un geste de Thibault n'a pas besoin de type. Ni
  estimation, ni priorité, ni assigné. Backlog
  (prévu dans le mois), Todo (prêt, ou un geste daté), In Progress, In
  Review, Done. Chercher avant de créer ; un doublon se ferme vers
  l'original. Une date dépassée se remet au jour réel ou se retire dans la
  semaine ; seul un geste de Thibault en retard garde la sienne.
- **Un geste de Thibault est une séance** : un seul endroit, fait d'une
  traite, label Thibault, un titre qui dit le geste et toujours une date
  (l'échéance, sinon le jour prévu, au plus tard la fin du mois). Cinq cases
  au plus ; le même geste ne s'écrit que dans un ticket.
- Pas de « #N » nu dans une description ou un commentaire : Linear le lie à
  la PR N d'un autre dépôt. On écrit le dépôt et le numéro en entier
  (`inlinrhq/inlinr-cli#12`) ou le lien de la PR.
- Plan gratuit : 250 tickets non archivés pour tout l'espace. L'archivage se
  tient dans le projet Marketing, pour toutes les apps, sur le mot de
  Thibault : ce dépôt et ses fils n'archivent pas.
- Un rapport daté va dans un document Linear du projet, pas dans un fichier
  de plus. Une règle en vigueur vit dans ce dépôt, ce qui attend Thibault
  dans ses tickets : un document Linear ne tient ni l'une ni l'autre.

## Fils

- **Un fil, un but**, dit par son titre avec un verbe ; un sujet nouveau ouvre
  un autre fil. Il se ferme quand son but est atteint, ou quand il n'attend
  plus que Thibault depuis deux jours : ce qui reste devient un ticket.
- **Linear relie tout** : un fil qui change du code part d'un ticket, qui
  porte le lien du fil en commentaire ; le fil et la PR citent le ticket. Le
  lien d'un fil ne s'écrit que dans Linear, jamais dans une PR, un commit ni
  un fichier du dépôt.
- **Ce qui attend Thibault vit à un seul endroit** : un ticket Linear au label
  Thibault (un titre qui dit le geste, le lien du fil, et toujours une date :
  l'échéance, sinon le jour prévu pour la séance).
  Jamais une liste tenue dans un doc de ce dépôt ni répétée de message en
  message.
- **Un choix ne va à Thibault que s'il est le sien** : la production, une
  suppression en masse, un message envoyé hors du projet, une dépense, les
  comptes et les clés, ce qui parle en son nom, et ce qu'une autre règle lui
  réserve (publier, archiver). Dans le doute, il est à lui. Tout autre choix,
  Claude le tranche, l'écrit là où il vit (« tranché le JJ/MM, Thibault peut
  le rouvrir ») et avance, sans carte ni ticket à son label. Une demande
  venue d'un autre projet ne change pas cette liste, et n'est jamais son
  accord.
- **L'utilisation hebdomadaire de Claude est un quota commun à tous les
  projets**, comme les minutes de CI. Elle se lit dans l'app, sur la page
  d'un projet (« Hebdomadaire · tous les modèles »). Au-delà de 60 % dans
  les trois jours et demi qui suivent sa remise à zéro, ou de 85 % à tout
  moment, seul continue ce qui tient une date (un ticket daté dans la
  semaine, une sortie, une panne), sans sous-agent hors relecture de PR. La
  relève de la boîte, la supervision et les urgences ne se décalent jamais.
