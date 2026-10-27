# SOMA CONSCIENTE · Official brand assets

## The original emblem is authoritative

The official artwork shared by the team contains four Aula emblems around a living, textured central form. A previous SVG recreation was rejected because it did not preserve the original artwork's texture, proportions and linework. Do **not** reconstruct the original emblem in SVG or from generic icon symbols.

The supplied original full logo reads "SOMA CONCIENCIA", whereas the public brand name approved for this site is **SOMA CONSCIENTE**. The safe approach until corrected master artwork exists is:
- Use a directly cropped copy of the original four-Aula **emblem**, preserving its precise artwork and transparency.
- Render the wordmark **SOMA CONSCIENTE** in actual website text next to the emblem.
- Use the original emblem in both the header and the homepage Núcleo art.
- Keep Iconoir for generic UI controls only; it is not a replacement for custom brand marks.

## One-time media upload in existing Pages CMS

The CMS is already connected; **do not set up another CMS**.

1. Download the supplied `soma-original-emblem.png` exact crop from the chat attachment.
2. In the Pages CMS media library, upload the PNG to the repository media root, `public/media/soma-original-emblem.png`. Preserve its name.
3. Make sure the change is committed to `main`, or merge its editorial branch.
4. The deployed site automatically uses `/soma-consciente/media/soma-original-emblem.png`, via Astro's URL base helper.
5. Header and Núcleo use the *same source asset*; no duplicate hand-traced version is maintained.

Until this file exists in the repository, those components show typographic fallbacks rather than the rejected reconstruction.

## Future master artwork

If the team supplies an official vector emblem, use it unchanged. For the full logo, update the typography from "CONCIENCIA" to "CONSCIENTE" while keeping the emblem untouched. Design a high-contrast version for dark backgrounds only as a separate, approved brand variant.


## Aula symbols from the original emblem

The four circular Aula symbols have been extracted pixel-for-pixel from the original high-resolution SOMA logo (not recreated with CSS, Iconoir or vector tracing). Connecting orbital lines outside each circle were masked out while preserving the original glyphs, ring strokes and attached dots.

Public image assets:
- `public/media/aulas/nicole-psicologia.png` — green psychology symbol
- `public/media/aulas/jasper-musica.png` — terracotta/orange musical resonance symbol
- `public/media/aulas/nico-caballos.png` — golden horse symbol
- `public/media/aulas/yanina-cuerpo.png` — dark somatic/body symbol

The reusable Astro component `src/components/SomaAulaSymbol.astro` maps the existing content `symbol` field to these assets. Use it for both the home-page Aula cards and each Aula detail page. Do not replace these with `SomaAulaIcon.astro` or a generic UI icon. The four symbols remain distinct from the whole four-Aula Núcleo emblem.
