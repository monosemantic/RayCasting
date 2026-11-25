// Permanent upgrades bought with gold. Each one changes the gameplay.

interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string; // inline SVG
}

const UPGRADES: UpgradeDef[] = [
  {
    id: "boots",
    name: "Bottes de course",
    description: "+20 % de vitesse de déplacement dans tous les niveaux.",
    cost: 60,
    icon: '<svg viewBox="0 0 24 24"><path d="M7 3h5v9l6 3c1.5.7 2 1.6 2 3v2H4v-4l3-2z" fill="currentColor"/></svg>',
  },
  {
    id: "compass",
    name: "Boussole",
    description: "Une flèche dans l'interface indique la direction de la sortie.",
    cost: 70,
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/></svg>',
  },
  {
    id: "hourglass",
    name: "Sablier ancien",
    description: "+20 secondes au chronomètre de chaque niveau.",
    cost: 80,
    icon: '<svg viewBox="0 0 24 24"><path d="M6 2h12v2c0 3-2.5 5-4.5 8 2 3 4.5 5 4.5 8v2H6v-2c0-3 2.5-5 4.5-8C8.5 9 6 7 6 4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 19h6l-3-4z" fill="currentColor"/></svg>',
  },
  {
    id: "heart",
    name: "Cœur de pierre",
    description: "+1 cœur maximum : les gardiens doivent te toucher 4 fois.",
    cost: 90,
    icon: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" fill="currentColor"/></svg>',
  },
  {
    id: "map",
    name: "Carte du cartographe",
    description: "Affiche la minimap du niveau pendant la partie (touche M).",
    cost: 150,
    icon: '<svg viewBox="0 0 24 24"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 3v15M15 6v15" stroke="currentColor" stroke-width="2"/></svg>',
  },
];

function sessionModifiers(save: SaveSystem): SessionModifiers {
  return {
    speedMultiplier: save.hasUpgrade("boots") ? 1.2 : 1,
    bonusTime: save.hasUpgrade("hourglass") ? 20 : 0,
    maxHearts: save.hasUpgrade("heart") ? 4 : 3,
  };
}
