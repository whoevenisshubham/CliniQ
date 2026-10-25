# Third-party notices

CliniQ repository history and contributor notices remain authoritative. Adapted MediFlow modules retain their source/contributor attribution in the files and reuse map.

Geist and Geist Mono: copyright The Geist Project Authors. Distributed through pinned `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` 5.3.0 under SIL Open Font License 1.1. Full notices are in each package's LICENSE and distributed under `/notices/Geist-LICENSE.txt` and `/notices/Geist-Mono-LICENSE.txt`. Fonts are bundled with the application; builds no longer fetch them from Google.

PDF.js / pdfjs-dist 6.4.299: Mozilla Foundation and contributors, Apache License 2.0. See `/notices/PDFjs-LICENSE.txt`, the installed package LICENSE and Mozilla's [PDF.js repository](https://github.com/mozilla/pdf.js). It is used only for bounded local source-text extraction, not rendering external scripts or inference.

Other dependencies retain their existing licenses and notices. This document does not replace them or assign a new license to third-party code.

Synthetic PDF regression fixtures embed Noto Sans Devanagari (SIL OFL 1.1) and Bitstream Vera Sans. Their full font notices and fixture provenance are retained beside the PDFs in `tests/fixtures/documents/`; these fonts are test assets, not new application web fonts.
