import type { SetItemInput } from './sets';
import type { Catalog } from './types';

/** Catalog names people type, mapped to stored catalog keys. */
const CATALOG_ALIASES: Record<string, Catalog> = {
  scott: 'scott', sc: 'scott',
  sg: 'stanley_gibbons', 'stanley gibbons': 'stanley_gibbons', gibbons: 'stanley_gibbons',
  michel: 'michel', mi: 'michel',
  yvert: 'yvert_tellier', 'yvert et tellier': 'yvert_tellier', yt: 'yvert_tellier',
  sakura: 'sakura', facit: 'facit',
};

/**
 * Reads the "stamps in this set" box: one stamp per line, written as
 * "1c Franklin" or "1c Franklin | Scott 112". A leading value with a digit
 * ("1c", "2½d", "60c") becomes the face value. The catalog part lets owned
 * stamps fill the slot automatically.
 */
export function parseSetItems(text: string): SetItemInput[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, cat] = line.split('|').map((x) => x.trim());
      const item: SetItemInput = { label };
      const fv = label.match(/^(\S*\d\S*)\s/);
      if (fv) item.faceValue = fv[1];
      if (cat) {
        const m = cat.match(/^(.*?)\s*([A-Za-z]{0,3}\d[\w-]*)$/);
        const key = m ? CATALOG_ALIASES[m[1].trim().toLowerCase()] : undefined;
        if (m && key) {
          item.catalog = key;
          item.catalogNumber = m[2];
        }
      }
      return item;
    });
}
