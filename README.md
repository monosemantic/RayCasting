## Run locally

```bash
git clone https://github.com/Badr-Eddine-Bourghel/Ray-Casting.git
cd Ray-Casting
npm install
npm run watch
```

Then open **[http://localhost:6969](http://localhost:6969)** in your browser.

## Le jeu

Un jeu d'exploration à la première personne construit sur le moteur de raycasting du projet.
Dans chaque niveau de la forteresse, il faut ramasser assez de pièces d'or pour déverrouiller
la sortie (lumière verte), éviter les gardiens spectraux et sortir avant la fin du chrono.

- **8 niveaux** répartis en 3 zones (Cachots, Salles Bleues, Donjon Pourpre), difficulté progressive.
- **Étoiles** : ★ terminer · ★★ toutes les pièces · ★★★ battre le temps de référence.
- **Or** : gagné en fin de niveau (pièces ramassées, bonus de première victoire, nouvelles étoiles, record de temps).
- **Boutique** : améliorations permanentes (vitesse, boussole, temps bonus, cœur supplémentaire, minimap).
- **Sauvegarde** automatique dans le navigateur (LocalStorage), y compris la partie en cours.
- **Mode libre** : la scène du prototype original, inchangée.

### Contrôles

| Action | Clavier | Tactile |
| --- | --- | --- |
| Avancer / reculer | W / S (Z / S en AZERTY), ↑ / ↓ | ▲ / ▼ |
| Tourner | A / D (Q / D en AZERTY), ← / → | ◀ / ▶ |
| Pause | Échap ou P | bouton ⏸ |
| Minimap (si achetée) | M | — |
| Valider | Entrée | — |

### Structure

```
index.ts          moteur de raycasting (rendu, rayons, collisions, déplacement)
index.html        canvas + écrans de l'interface
game/save.ts      sauvegarde et calcul des récompenses
game/levels.ts    zones, niveaux (cartes ASCII), scène de niveau, scène originale
game/sprites.ts   sprites (billboards) avec test de profondeur + textures procédurales
game/session.ts   règles d'un niveau (chrono, or, gardiens, cœurs, sortie)
game/shop.ts      améliorations de la boutique
game/audio.ts     effets sonores synthétisés (WebAudio)
game/ui.ts        menus, carte du monde, HUD, dialogues
game/main.ts      démarrage, boucle de jeu, entrées clavier/tactile
game/style.css    styles de l'interface
```

Légende des cartes (`game/levels.ts`) : caractères de mur définis par la palette du niveau,
`.` sol, `S` départ, `c` pièce, `X` sortie, `b` tonneau, `p` pilier, `l` lampe,
`h` / `v` gardien patrouillant horizontalement / verticalement.
