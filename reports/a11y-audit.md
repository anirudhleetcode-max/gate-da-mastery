# Accessibility & responsive audit

Run: 2026-10-05T17:18:18.775Z against http://localhost:3302. axe-core 4.13.0, WCAG 2.1 A/AA rules, light and dark themes at 1280px; horizontal overflow at 320, 360, 390, 412, 768, 1024, 1440, 1920 px.

Routes: 14, with violations or overflow: 0.

| Route | HTTP | axe violations | Overflow | Console errors |
| --- | --- | --- | --- | --- |
| /concepts | 200 | 0 | none | 0 |
| /concepts/c-dbw-keys-integrity-constraints | 200 | 0 | none | 0 |
| /concepts/c-ml-classification-metrics | 200 | 0 | none | 0 |
| /concepts?subject=la&q=eigen | 200 | 0 | none | 0 |
| /formulas | 200 | 0 | none | 0 |
| /formulas/la | 200 | 0 | none | 0 |
| /formulas/ps | 200 | 0 | none | 0 |
| /formulas/ml | 200 | 0 | none | 0 |
| /strategy | 200 | 0 | none | 0 |
| /strategy/timer | 200 | 0 | none | 0 |
| /roadmap | 200 | 0 | none | 0 |
| /concepts/nope | 404 | 0 | none | 2 |
| /formulas/nope | 404 | 0 | none | 2 |
| /strategy/nope | 404 | 0 | none | 2 |

