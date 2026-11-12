// Pick lists for Stamp Card fields. Stored value -> label shown in the app.
// Stored values match the phone app's database, so backups move between them.

function pickList(labels) {
  return { values: Object.keys(labels), labels };
}

export const CATALOGS = pickList({
  scott: 'Scott', stanley_gibbons: 'Stanley Gibbons', michel: 'Michel',
  yvert_tellier: 'Yvert et Tellier', sakura: 'Sakura', facit: 'Facit', other: 'Other',
});

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
