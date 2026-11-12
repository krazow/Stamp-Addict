// Pick lists for Stamp Card fields. Stored value -> label shown in the app.
// Stored values match the phone app's database, so backups move between them.

function pickList(labels) {
  return { values: Object.keys(labels), labels };
}

export const CATALOGS = pickList({
  scott: 'Scott', stanley_gibbons: 'Stanley Gibbons', michel: 'Michel',
  yvert_tellier: 'Yvert et Tellier', sakura: 'Sakura', facit: 'Facit',
  unitrade: 'Unitrade', acsc: 'ACSC (Brusden-White)', zumstein: 'Zumstein', edifil: 'Edifil',
  sassone: 'Sassone', nvph: 'NVPH', afa: 'AFA', fischer: 'Fischer', ank: 'ANK',
  hellas: 'Hellas', zagorski: 'Zagorski', pofis: 'Pofis', rhm: 'RHM', gj: 'GJ (Gottig Jalil)',
  cob: 'COB', other: 'Other',
});

/** Where each catalogue is the standard, shown as a hint in the catalogue drop-down. */
export const CATALOG_REGIONS = {
  scott: 'United States, the Americas, worldwide', stanley_gibbons: 'Great Britain and the Commonwealth',
  michel: 'Germany and Europe', yvert_tellier: 'France and French areas', sakura: 'Japan', facit: 'Nordic countries',
  unitrade: 'Canada', acsc: 'Australia', zumstein: 'Switzerland and Liechtenstein', edifil: 'Spain and Spanish areas',
  sassone: 'Italy, San Marino, Vatican', nvph: 'Netherlands and Dutch areas', afa: 'Denmark, Faroe Islands, Greenland',
  fischer: 'Poland', ank: 'Austria', hellas: 'Greece', zagorski: 'Russia and the USSR', pofis: 'Czech Republic and Slovakia',
  rhm: 'Brazil', gj: 'Argentina', cob: 'Belgium and Belgian Congo', other: 'Any other catalogue',
};

/** Short names collectors write before a number: "SG 368", "Mi 12". */
export const CATALOG_SHORT = {
  scott: 'Scott', stanley_gibbons: 'SG', michel: 'Mi', yvert_tellier: 'YT', sakura: 'Sakura', facit: 'Facit',
  unitrade: 'Unitrade', acsc: 'ACSC', zumstein: 'Zum', edifil: 'Edifil', sassone: 'Sassone', nvph: 'NVPH',
  afa: 'AFA', fischer: 'Fischer', ank: 'ANK', hellas: 'Hellas', zagorski: 'Zagorski', pofis: 'Pofis', rhm: 'RHM', gj: 'GJ', cob: 'COB', other: '',
};

/** The catalogues people use most, listed first in drop-downs. */
export const MAIN_CATALOGS = ['scott', 'stanley_gibbons', 'michel', 'yvert_tellier'];

export const STAMP_TYPES = pickList({
  definitive: 'Definitive', commemorative: 'Commemorative', airmail: 'Airmail',
  postage_due: 'Postage due', semi_postal: 'Semi-postal', official: 'Official',
  revenue: 'Revenue', special_delivery: 'Special delivery', parcel_post: 'Parcel post', other: 'Other',
});

export const SEPARATIONS = pickList({
  perforated: 'Perforated', imperforate: 'Imperforate', rouletted: 'Rouletted',
  die_cut: 'Die-cut', part_perforate: 'Part-perforate',
});

export const PAPER_TYPES = pickList({
  wove: 'Wove', laid: 'Laid', chalky: 'Chalky (chalk-surfaced)', granite: 'Granite',
  quadrille: 'Quadrillé', batonne: 'Bâtonné', pelure: 'Pelure', india: 'India',
  fluorescent: 'Fluorescent', other: 'Other',
});

export const PRINTING_METHODS = pickList({
  engraved: 'Engraved (intaglio)', lithography: 'Lithography', photogravure: 'Photogravure',
  typography: 'Typography (letterpress)', offset: 'Offset', embossed: 'Embossed', other: 'Other',
});

export const GUMS = pickList({
  original: 'Original gum', regummed: 'Regummed', no_gum: 'No gum',
  self_adhesive: 'Self-adhesive', ungummed: 'Issued without gum',
});

export const TAGGINGS = pickList({
  untagged: 'Untagged', tagged: 'Tagged', phosphor_bands: 'Phosphor bands',
  fluorescent: 'Fluorescent paper', other: 'Other',
});

export const FORMATS = pickList({
  single: 'Single', pair: 'Pair', strip: 'Strip', block: 'Block', sheet: 'Sheet',
  booklet_pane: 'Booklet pane', coil: 'Coil', souvenir_sheet: 'Souvenir sheet',
  cover: 'On cover', fdc: 'First day cover', other: 'Other',
});

export const MINT_STATUSES = pickList({
  mnh: 'Mint never hinged (MNH)', mh: 'Mint hinged (MH)', mlh: 'Mint lightly hinged (MLH)',
  mint_no_gum: 'Mint, no gum', used: 'Used', cto: 'Cancelled to order (CTO)',
});

export const CENTERINGS = pickList({
  superb: 'Superb', xf: 'Extremely fine (XF)', vf: 'Very fine (VF)',
  f: 'Fine (F)', vg: 'Very good (VG)', g: 'Good (G)',
});

export const PHOTO_ROLES = pickList({
  front: 'Front', back: 'Back', detail: 'Detail close-up', watermark: 'Watermark',
  uv: 'UV light', certificate: 'Certificate',
});

export const PRIORITIES = pickList({ high: 'High', medium: 'Medium', low: 'Low' });

export function labelOf(list, value) {
  return value ? list.labels[value] ?? value : null;
}
