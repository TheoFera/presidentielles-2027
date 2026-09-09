// Small line drawings stay sharp on mobile and share the interface's ink palette.
const drawings = {
  MEETING_DE_CRISE: '<path d="M7 14h7l12-7v20l-12-7H7z"/><path d="m11 21 2 8h5l-3-8M29 12l3-2m-3 7h4m-4 5 3 2"/>',
  CHOC_OPINION: '<path d="m19 4-11 16h9l-2 12 13-18h-9z"/>',
  CANDIDAT_FRAGILISE: '<path d="M9 27c0-8 18-8 18 0M14 10a5 5 0 1 0 10 0 5 5 0 1 0-10 0"/><path d="m6 8 3 2m20-1 3-2M5 17h4m21 0h3"/>',
  PIEGE_MEDIATIQUE: '<rect x="14" y="4" width="9" height="17" rx="4"/><path d="M10 15v3a9 9 0 0 0 18 0v-3M19 27v5m-6 0h12M16 9h5m-5 4h5"/>',
  DEBAT_THEMATIQUE: '<path d="M4 6h21v14H13l-6 5v-5H4zM26 13h6v14h-5v5l-6-5h-7v-4"/><path d="M9 11h11m-11 4h8"/>',
  CRISE_FINANCEMENT: '<path d="M25 7c-13-8-21 22-5 22 3 0 5-1 7-3M6 14h17M5 20h17m7-14 3 5m-2 2 2 3"/>',
  FERMETURE_BATIMENT: '<path d="M6 31V8h25v23M4 8h29V4H4zM11 13h15m-15 5h15m-15 5h15M4 31h29"/><rect x="16" y="24" width="8" height="8" rx="2"/>'
};
export const eventIconData = Object.fromEntries(Object.entries(drawings).map(([id, paths]) => [id,
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37"><g fill="#f1d19a" stroke="#344448" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`)}")`
]));
