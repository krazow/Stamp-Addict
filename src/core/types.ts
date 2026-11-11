/**
 * Stamp Card data types and pick lists.
 *
 * Each pick list has a stored value (used in the database) and a display
 * label (shown in the app). Every Stamp Card field is optional.
 */

function pickList<const T extends Record<string, string>>(labels: T) {
  return {
    values: Object.keys(labels) as Array<keyof T & string>,
    labels,
  };
}

export const CATALOGS = pickList({
  scott: 'Scott',
  stanley_gibbons: 'Stanley Gibbons',
  michel: 'Michel',
  yvert_tellier: 'Yvert et Tellier',
  sakura: 'Sakura',
  facit: 'Facit',
  other: 'Other',
});

export const STAMP_TYPES = pickList({
  definitive: 'Definitive',
  commemorative: 'Commemorative',
  airmail: 'Airmail',
  postage_due: 'Postage due',
  semi_postal: 'Semi-postal',
  official: 'Official',
  revenue: 'Revenue',
  special_delivery: 'Special delivery',
  parcel_post: 'Parcel post',
  other: 'Other',
});

export const SEPARATIONS = pickList({
  perforated: 'Perforated',
  imperforate: 'Imperforate',
  rouletted: 'Rouletted',
  die_cut: 'Die-cut',
  part_perforate: 'Part-perforate',
});

export const PAPER_TYPES = pickList({
  wove: 'Wove',
  laid: 'Laid',
  chalky: 'Chalky (chalk-surfaced)',
  granite: 'Granite',
  quadrille: 'Quadrillé',
  batonne: 'Bâtonné',
  pelure: 'Pelure',
  india: 'India',
  fluorescent: 'Fluorescent',
  other: 'Other',
});

export const PRINTING_METHODS = pickList({
  engraved: 'Engraved (intaglio)',
  lithography: 'Lithography',
  photogravure: 'Photogravure',
  typography: 'Typography (letterpress)',
  offset: 'Offset',
  embossed: 'Embossed',
  other: 'Other',
});

export const GUMS = pickList({
  original: 'Original gum',
  regummed: 'Regummed',
  no_gum: 'No gum',
  self_adhesive: 'Self-adhesive',
  ungummed: 'Issued without gum',
});

export const TAGGINGS = pickList({
  untagged: 'Untagged',
  tagged: 'Tagged',
  phosphor_bands: 'Phosphor bands',
  fluorescent: 'Fluorescent paper',
  other: 'Other',
});

export const FORMATS = pickList({
  single: 'Single',
  pair: 'Pair',
  strip: 'Strip',
  block: 'Block',
  sheet: 'Sheet',
  booklet_pane: 'Booklet pane',
  coil: 'Coil',
  souvenir_sheet: 'Souvenir sheet',
  cover: 'On cover',
  fdc: 'First day cover',
  other: 'Other',
});

export const MINT_STATUSES = pickList({
  mnh: 'Mint never hinged (MNH)',
  mh: 'Mint hinged (MH)',
  mlh: 'Mint lightly hinged (MLH)',
  mint_no_gum: 'Mint, no gum',
  used: 'Used',
  cto: 'Cancelled to order (CTO)',
});

export const CENTERINGS = pickList({
  superb: 'Superb',
  xf: 'Extremely fine (XF)',
  vf: 'Very fine (VF)',
  f: 'Fine (F)',
  vg: 'Very good (VG)',
  g: 'Good (G)',
});

export const PHOTO_ROLES = pickList({
  front: 'Front',
  back: 'Back',
  detail: 'Detail close-up',
  watermark: 'Watermark',
  uv: 'UV light',
  certificate: 'Certificate',
});

export const PRIORITIES = pickList({ high: 'High', medium: 'Medium', low: 'Low' });

export type Catalog = (typeof CATALOGS.values)[number];
export type StampType = (typeof STAMP_TYPES.values)[number];
export type Separation = (typeof SEPARATIONS.values)[number];
export type PaperType = (typeof PAPER_TYPES.values)[number];
export type PrintingMethod = (typeof PRINTING_METHODS.values)[number];
export type Gum = (typeof GUMS.values)[number];
export type Tagging = (typeof TAGGINGS.values)[number];
export type Format = (typeof FORMATS.values)[number];
export type MintStatus = (typeof MINT_STATUSES.values)[number];
export type Centering = (typeof CENTERINGS.values)[number];
export type PhotoRole = (typeof PHOTO_ROLES.values)[number];
export type Priority = (typeof PRIORITIES.values)[number];

/** The scalar (single-value) fields of a Stamp Card. All optional. */
export interface StampFields {
  collectionId?: string | null;
  setItemId?: string | null;

  // Identification
  country?: string | null;
  year?: number | null;
  issueDate?: string | null;
  faceValue?: string | null;
  currency?: string | null;
  colors?: string | null;
  designSubject?: string | null;
  stampType?: StampType | null;
  designer?: string | null;
  engraver?: string | null;
  printer?: string | null;

  // Physical and technical
  perfHorizontal?: number | null;
  perfVertical?: number | null;
  separation?: Separation | null;
  watermark?: string | null;
  paperType?: PaperType | null;
  printingMethod?: PrintingMethod | null;
  gum?: Gum | null;
  tagging?: Tagging | null;
  format?: Format | null;
  widthMm?: number | null;
  heightMm?: number | null;

  // Condition
  mintStatus?: MintStatus | null;
  centering?: Centering | null;
  grade?: number | null;
  cancellation?: string | null;
  faults?: string | null;
  hasCertificate?: boolean | null;

  // Varieties
  errorVariety?: string | null;
  plateNumber?: string | null;
  overprint?: string | null;
  shade?: string | null;

  // Collection management
  quantity?: number;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  purchaseDate?: string | null;
  source?: string | null;
  estimatedValue?: number | null;
  storageLocation?: string | null;
  forTrade?: boolean;
  notes?: string | null;
}

export interface CatalogNumberInput {
  catalog: Catalog;
  number: string;
  catalogLabel?: string | null;
  catalogValue?: number | null;
  valueCurrency?: string | null;
  edition?: string | null;
}

export interface CatalogNumber extends CatalogNumberInput {
  id: string;
}

export interface PhotoInput {
  role: PhotoRole;
  uri: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

export interface Photo extends PhotoInput {
  id: string;
  sortOrder: number;
}

/**
 * Input for creating or editing a Stamp Card.
 * On edit, any list that is given (catalogNumbers, photos, tags)
 * replaces the stamp's current list; a list left out is kept.
 */
export interface StampCardInput extends StampFields {
  catalogNumbers?: CatalogNumberInput[];
  photos?: PhotoInput[];
  tags?: string[];
}

/** A full Stamp Card as stored. */
export interface StampCard extends StampFields {
  id: string;
  quantity: number;
  forTrade: boolean;
  catalogNumbers: CatalogNumber[];
  photos: Photo[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** A lightweight row for the collection grid / list view. */
export interface StampSummary {
  id: string;
  country: string | null;
  year: number | null;
  faceValue: string | null;
  designSubject: string | null;
  mintStatus: MintStatus | null;
  thumbnailUri: string | null;
  primaryCatalog: string | null; // e.g. "Scott 219"
}
