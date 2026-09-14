# Third-party attributions

TTAK's opt-in guidance text is derived from the pinned MIT-licensed sources below. These notices
record provenance and satisfy `[LIC-002]` and `[LIC-005]`. TTAK has no runtime dependency on any of
these projects. None of their authors endorses TTAK, and naming them here is factual attribution
only, not affiliation (`[LIC-006]`).

What this package takes is direction, not wording. Measured 2026-09-15 file-wide against each source
at its pin, the longest word run shared with any shipped text is **4 words** — `use when the user`,
a standard skill-description idiom; every other run is two or three common words. The `[LIC-001]`
tracking record, `docs/COPIED_TEXT_INVENTORY.md`, belongs to the earlier release candidate, which
reproduced upstream policy text; it lives in the TTAK source repository and is not part of this
package. Its two findings that needed a human ruling, F1 and F4, were ruled on 2026-09-07.

Each notice below is reproduced verbatim as published at the pinned revision. One of them names no
copyright holder; it is reproduced anyway, and the reason is stated in that section.

---

## DietrichGebert/ponytail

- Source: https://github.com/DietrichGebert/ponytail
- Pinned revision: `2ed6c52c9d7e5e56942508591085fd45dea277d3` (2026-08-07)
- Files read at that revision: `skills/ponytail/SKILL.md`, `skills/ponytail-review/SKILL.md`,
  `LICENSE`
- TTAK artifacts derived from it: `policy/core.md`, `references/review.md`
- **What was taken.** Reusing what the project already has, dropping work that carries no present
  value, and judging a simplification against the behavior it has to preserve. The persona, the
  line- and file-count priority, the mandatory full exploration, and delivering less than the user
  asked for were not taken.
- Notice, reproduced verbatim from `LICENSE` at that revision:

```
MIT License

Copyright (c) 2026 DietrichGebert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## ayghri/i-have-adhd

- Source: https://github.com/ayghri/i-have-adhd
- Pinned revision: `58494af57962b2d7a996b4d419474380a299af5e` (2026-09-01)
- Files read at that revision: `skills/i-have-adhd/SKILL.md`, `LICENSE`
- TTAK artifacts derived from it: `policy/core.md`
- **What was taken.** Visible progress, honest completion, and returning to an interrupted goal from
  records that are actually available. The diagnosis premise, per-turn status repetition, the
  five-item list cap and mandatory time estimates were not taken.
- **Second pin.** The author's earlier plugin pinned this same project at
  `cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c`, and that pin stays in the record because it is what
  the text TTAK adapted was read against. **Measured 2026-09-07: `skills/i-have-adhd/SKILL.md` is
  byte-identical at both revisions**, 6813 bytes each — so the two pins select one text, and
  `58494af...` is the pin that applies everywhere. The notice text is identical at both revisions.
- Notice, reproduced verbatim from `LICENSE` at revision `58494af57962b2d7a996b4d419474380a299af5e`:

```
MIT License

Copyright (c) 2026 Ayoub Ghriss

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## DreambigOu/ELI5

- Source: https://github.com/DreambigOu/ELI5
- Pinned revision: `a766623b062331fdde53467001379b4ddf3acc2f` (2026-03-17)
- Files read at that revision: `skills/eli5/SKILL.md`, `README.md`, `LICENSE`
- TTAK artifacts derived from it: `references/explain.md`
- **What was taken.** Choosing depth and vocabulary for the reader and the purpose. The
  five-year-old default reader, the age-based stereotypes, the obligatory analogy, and simplification
  that trades away accuracy were not taken.
- **This notice names no copyright holder.** The upstream `LICENSE` at the pinned revision carries
  the year and nothing after it. It is reproduced below exactly as published. Inserting a name would
  be a false attribution statement, so none is inserted. `skills/eli5/SKILL.md` at that revision also
  carries no `license` key in its frontmatter, so its licence coverage rests on this file alone. The
  repository `README.md` was read at the same revision for a holder and names none either: its
  `## License` section, L144-146, is the single word `MIT`. The inventory recorded this as F4 under
  `[LIC-008]` and ruled on 2026-09-07 that the state is accepted as published, because TTAK ships no
  reproduced expression from this source and inserting a holder would be the false statement.
- Notice, reproduced verbatim from `LICENSE` at that revision:

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## TTAK's own licence

TTAK ships under MIT (`LICENSE`, and one identical licence string in both manifests and in the
settings skill's frontmatter). `[LIC-007]` requires that this choice be confirmed by the
copied-content review rather than assumed. That review was performed on the earlier candidate and
ruled on 2026-09-07, closing `[AC-012]` for it. This package ships no reproduced expression from any
source above, so MIT stands here too. It is an inactive design prototype and is not being
redistributed.
