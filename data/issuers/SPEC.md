# Stamp issuer list: format for each region file

Goal: every entity that has issued postage stamps (countries, colonies, territories, protectorates,
mandates, occupation authorities, city-states, princely/feudatory states, local/provisional
issues that the major catalogues list as their own section, UN/postal agencies), as recognised
by the worldwide stamp community: the country headings used by Scott, Stanley Gibbons, Michel
and Yvert et Tellier.

Granularity rule: one entry per heading a major catalogue gives its own section (or that
collectors commonly treat as a separate "country"). Don't split by stamp series or by
individual overprint. Do include dead countries and pre-unification states (e.g. Bavaria,
Tuscany), and occupation issues that catalogues list separately (e.g. "German Occupation of
Belgium (WWI)").

Output: a JSON array (UTF-8, 2-space indent) of objects with exactly these keys:

```json
{
  "id": "great-britain",
  "name": "Great Britain",
  "aliases": ["United Kingdom", "UK"],
  "type": "country",
  "region": "Europe",
  "subregion": "Western Europe",
  "from": 1840,
  "to": null,
  "parent": null,
  "successor": null,
  "catalog": "stanley_gibbons",
  "notes": null
}
```

- id: lowercase ASCII kebab-case, unique, stable. For same-named issuers add a qualifier
  (e.g. "german-occupation-belgium-ww1").
- name: the English heading collectors use (Scott/SG style). Keep native characters out of
  `name`; put native or other-language names in `aliases`.
- aliases: other names people would search for: former names, native names, Scott/SG/Michel
  spelling differences, common abbreviations. [] if none. No more than 8.
- type: one of country, colony, territory, protectorate, mandate, occupation, city_state,
  princely_state, state, local, agency, other.
- region: one of Americas, Europe, Africa, Asia, Oceania, Polar, International.
- subregion: one of North America, Central America, Caribbean, South America,
  Western Europe, Northern Europe, Central Europe, Eastern Europe, Southern Europe,
  North Africa, West Africa, Central Africa, East Africa, Southern Africa, Indian Ocean,
  Middle East, Central Asia, South Asia, East Asia, Southeast Asia, Oceania, Atlantic,
  Antarctic, International.
- from / to: year of first and last stamp issue (integers). to = null if it still issues
  stamps. Use your best-supported year; don't invent precision you can't support.
- parent: for colonies, occupations, territories and states: the `name` of the
  administering or occupying power (e.g. "Great Britain", "France", "Germany"). null otherwise.
- successor: the `name` of the issuer that took over (e.g. Ceylon -> "Sri Lanka"), else null.
- catalog: the catalogue most collectors use for this issuer. One of:
  scott, stanley_gibbons, michel, yvert_tellier, sakura, facit, unitrade, acsc, zumstein,
  edifil, sassone, nvph, afa, fischer, ank, hellas, zagorski, pofis, rhm, gj, other.
  Guide: US and US possessions -> scott; Canada -> unitrade; Australia -> acsc;
  Great Britain, Ireland and the British Commonwealth/colonies -> stanley_gibbons;
  Germany, German states and German occupations -> michel; France and French colonies ->
  yvert_tellier; Japan -> sakura; Sweden, Norway, Finland, Iceland -> facit;
  Denmark, Faroe Islands, Greenland -> afa; Switzerland, Liechtenstein -> zumstein;
  Spain and Spanish colonies -> edifil; Italy, Italian states, San Marino, Vatican,
  Italian colonies -> sassone; Netherlands and Dutch colonies -> nvph; Poland -> fischer;
  Austria -> ank; Greece -> hellas; Russia/USSR -> zagorski; Czechoslovakia, Czech Republic,
  Slovakia -> pofis; Brazil -> rhm; Argentina -> gj; Latin America, Asia (except Japan) and
  everywhere else -> scott, unless another catalogue is clearly dominant there.
- notes: one short sentence only when it helps tell similar entries apart, else null.

Write ONLY your own file. Validate it (it must parse as JSON, every object must have all
keys, ids unique) before finishing.
