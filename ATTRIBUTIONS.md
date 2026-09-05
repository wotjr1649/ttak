# Third-party attributions

TTAK's shipped instruction text is derived from the pinned MIT-licensed sources below. These notices
record provenance and satisfy `[LIC-002]` and `[LIC-005]`. TTAK has no runtime dependency on any of
these projects. None of their authors endorses TTAK, and naming them here is factual attribution
only, not affiliation (`[LIC-006]`).

Which TTAK paragraph derives from which source line — the `[LIC-001]` tracking record — is in
[`docs/COPIED_TEXT_INVENTORY.md`](docs/COPIED_TEXT_INVENTORY.md). This file is the notice file; that
one is the tracking file, and it records two open items that `[LIC-007]` and `[AC-012]` still need a
human ruling on.

Each notice below is reproduced **verbatim as published** at the pinned revision. One of them is
unusual; it is reproduced anyway, and the reason is stated in that section.

---

## DietrichGebert/ponytail

- Source: https://github.com/DietrichGebert/ponytail
- Pinned revision: `2ed6c52c9d7e5e56942508591085fd45dea277d3` (2026-08-07)
- Files read at that revision: `skills/ponytail/SKILL.md`, `skills/ponytail-review/SKILL.md`,
  `LICENSE`
- TTAK artifacts derived from it: `policy/invariants.md`, `policy/precedence.md`,
  `policy/contract.md`
- **Route.** `policy/precedence.md` derives from this source directly. `policy/invariants.md` and
  `policy/contract.md` reach it through `wotjr1649/leanclarity` at
  `7dfe5b2e25166e91069034038ac59121f771e844`, listed below — a two-step chain, recorded here because
  the commit each artifact passed through is part of the record. The measurement behind that
  statement is in `docs/COPIED_TEXT_INVENTORY.md`.
- `skills/ponytail-review/SKILL.md` is listed because it was read, not because material was carried:
  no Review material ships in v1 (`TTAK Review` is deferred to v1.1). If v1.1 carries any, this entry
  becomes a derivation source for it.
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
- TTAK artifacts derived from it: `policy/contract.md`, `policy/precedence.md`,
  `skills/ttak-explain/SKILL.md`
- **Second pin, and the route.** `wotjr1649/leanclarity`, listed below, pins this same project at
  `cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c`. `policy/precedence.md` and
  `skills/ttak-explain/SKILL.md` derive from this source directly, so `58494af...` is their chain.
  `policy/contract.md` reaches it through that intermediate at
  `7dfe5b2e25166e91069034038ac59121f771e844`, so **both pins are live for it**:
  `cbe69fb8...` for the upstream text as the predecessor read it, and `58494af...` for the revision
  this project's line citations were read against. The notice text is identical at both revisions.
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
- TTAK artifacts derived from it: `skills/ttak-explain/SKILL.md`
- **This notice names no copyright holder.** The upstream `LICENSE` at the pinned revision carries
  the year and nothing after it. It is reproduced below exactly as published. Inserting a name would
  be a false attribution statement, so none is inserted. `skills/eli5/SKILL.md` at that revision also
  carries no `license` key in its frontmatter, so its licence coverage rests on this file alone. The
  repository `README.md` was read at the same revision for a holder and names none either: its
  `## License` section, L144-146, is the single word `MIT`. This is recorded as an unresolved licence
  question under `[LIC-008]` in the inventory, and is escalated rather than decided here.
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

## wotjr1649/leanclarity

- Source: https://github.com/wotjr1649/leanclarity
- Pinned revision: `7dfe5b2e25166e91069034038ac59121f771e844` (2026-08-31), one commit past the
  `v1.0.3` tag. The manifest at that commit still declares version `1.0.2`, so the version string
  does not identify the source basis and the commit is the pin.
- Files read at that revision: `policies/engineering.md`, `policies/guidance.md`, `README.md`,
  `THIRD_PARTY_NOTICES.md`, `docs/evidence/LeanClarity_v1.0_GO_EVIDENCE.md`, `LICENSE`
- TTAK artifacts derived from it: `policy/invariants.md`, `policy/contract.md`, `README.md`,
  `README.ko.md`
- This is the author's own prior plugin, which TTAK supersedes. Same author, same licence; the notice
  is reproduced on the same terms as any other.
- The measurements TTAK republishes in its READMEs — the null behaviour result, the failed behaviour
  gate, and the guidance-composition figure — are read from this project's evidence record at this
  revision.
- Notice, reproduced verbatim from `LICENSE` at that revision:

```
MIT License

Copyright (c) 2026 LeanClarity contributors

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

TTAK ships under MIT (`LICENSE`, and one identical licence string in every manifest and skill
frontmatter). `[LIC-007]` requires that this choice be confirmed by the copied-content review rather
than assumed. The inventory that review needs now exists; it records two items
(`docs/COPIED_TEXT_INVENTORY.md`, findings F1 and F4) that a human has not yet ruled on. MIT remains
the expected outcome, not a closed decision, and `[AC-012]` is not closed.
