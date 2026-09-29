# Accessibility & responsive audit

Run: 2026-09-29T23:20:43.836Z against http://127.0.0.1:3100. axe-core 4.13.0, WCAG 2.1 A/AA rules, light and dark themes at 1280px; horizontal overflow at 320, 360, 390, 412, 768, 1024, 1440, 1920 px.

Routes: 24, with violations or overflow: 2.

| Route | HTTP | axe violations | Overflow | Console errors |
| --- | --- | --- | --- | --- |
| / | 200 | 0 | none | 4 |
| /syllabus | 200 | 0 | none | 4 |
| /subjects | 200 | 0 | none | 4 |
| /subjects/ml | 200 | 0 | none | 5 |
| /subjects/ml/topics/ml-supervised | 404 | 0 | none | 5 |
| /pyqs | 200 | 0 | none | 4 |
| /pyqs/browse | 200 | 0 | 320px: scrollWidth 380; 360px: scrollWidth 380 | 4 |
| /pyqs/papers/DA-2026-S8 | 200 | 0 | none | 4 |
| /questions/DA2026-S8-Q36 | 200 | 0 | none | 4 |
| /questions/DA2024-S1-Q14 | 200 | 0 | none | 4 |
| /questions/M01-Q01 | 200 | 0 | none | 4 |
| /mocks | 200 | 0 | none | 4 |
| /mocks/mock-01 | 200 | 0 | 320px: scrollWidth 325 | 4 |
| /practice | 200 | 0 | none | 4 |
| /today | 200 | 0 | none | 4 |
| /progress | 200 | 0 | none | 4 |
| /weightage | 200 | 0 | none | 4 |
| /revision | 200 | 0 | none | 4 |
| /errors | 200 | 0 | none | 4 |
| /bookmarks | 200 | 0 | none | 4 |
| /search?q=eigenvalue | 200 | 0 | none | 5 |
| /sources | 200 | 0 | none | 4 |
| /settings | 200 | 0 | none | 4 |
| /this-route-does-not-exist | 404 | 0 | none | 1 |

## /pyqs/browse
- overflow 320px: scrollWidth 380
- overflow 360px: scrollWidth 380

## /mocks/mock-01
- overflow 320px: scrollWidth 325

