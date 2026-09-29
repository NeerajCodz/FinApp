export const iconPurposeCategories = [
  { id: 'finance', label: 'Finance & money' },
  { id: 'people', label: 'People' },
  { id: 'communication', label: 'Communication' },
  { id: 'places', label: 'Places & travel' },
  { id: 'time', label: 'Time' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'tools', label: 'Tools & files' },
  { id: 'other', label: 'Other' },
  { id: 'all', label: 'All icons' },
] as const;

export type IconPurpose = (typeof iconPurposeCategories)[number]['id'];

const purposeRules: readonly [Exclude<IconPurpose, 'all' | 'other'>, RegExp][] = [
  [
    'finance',
    /wallet|bank|credit|coin|dollar|receipt|cash|landmark|piggy|currency|money|calculator|percent/,
  ],
  [
    'people',
    /user|person|people|contact|handshake|heart|smile|accessibility|baby|child|fingerprint/,
  ],
  ['communication', /mail|message|phone|bell|send|share|speech|chat|video|headphones|megaphone/],
  [
    'places',
    /home|house|map|pin|location|building|store|car|plane|train|bus|globe|mountain|bed|landmark/,
  ],
  ['time', /calendar|clock|timer|history|watch|hourglass|alarm/],
  ['analytics', /chart|graph|trending|activity|gauge|chart|percent/],
  [
    'tools',
    /file|folder|clipboard|edit|pen|copy|code|wrench|hammer|image|camera|book|package|terminal|settings|filter|search|list/,
  ],
];

export function getIconPurpose(name: string): IconPurpose {
  const normalized = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return purposeRules.find(([, rule]) => rule.test(normalized))?.[0] ?? 'other';
}
