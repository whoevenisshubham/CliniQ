# Bounded PDF fidelity fixtures

Two synthetic two-page PDFs exercise the parser's literal Unicode, numbers, units and page references. They contain no real patient data. The column fixture deliberately tests spatially separated content; its assertions do not infer table relationships, clinical meaning, semantic reading order or confidence.

The bilingual fixture embeds shaped Noto Sans Devanagari (SIL OFL 1.1) and ReportLab's bundled Bitstream Vera Sans (included license). The columns fixture embeds Vera. Font licenses are retained beside these PDFs. Noto source: https://notofonts.github.io/devanagari/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf ; downloaded font SHA256 `6600a318c94f6c7d5d6ea6e0133c017748c6449f426558adb9691747d2165613`.

Generated with ReportLab 4.4.9 and HarfBuzz shaping, then visually reviewed with Poppler. `expected.json` records exact PDF hashes and literal page expectations. These fixtures establish representative support only, not universal PDF/Hindi extraction. Hosted execution evidence is kept separately from this offline regression.
