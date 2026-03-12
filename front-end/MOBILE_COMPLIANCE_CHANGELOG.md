# Mobile design compliance – changelog and audit

## Changelog (grouped)

### Shared / global

- **index.css**
  - Added `@media (max-width: 640px)` block with:
    - `min-height: 44px` for buttons and key interactive elements (nav, modals, feature buttons, auth submit/link).
    - `min-width: 44px` for icon/compact controls (nav logout/avatar, sidebar links, modal actions, chip/action buttons) to meet touch-target guidelines.
    - Table wrappers (`.cd__table-wrap`, `.qz__table-wrap`, `.tm__table-wrap`, `.st__table-wrap`, `.cc__table-wrap`, `.lpdv__table-wrap`, `.lcp__table-wrap`): `max-width: 100%` and `-webkit-overflow-scrolling: touch` for contained, touch-friendly horizontal scroll.
    - `overflow-wrap: break-word` / `word-break: break-word` on card titles and key headings (assignments, dashboard, quizzes, teachers, plans, stats) to prevent long strings from breaking layout.
- **confirm-action-modal.css**
  - At `max-width: 640px`: `.cam__actions` stacks vertically (`flex-direction: column`), buttons full width and `min-height: 44px`.

### Layout / navigation

- **app-layout.css**
  - At `max-width: 480px`: main content padding set to `var(--space-md) var(--space-sm)` for slightly better balance on very small viewports.
- **nav-bar.css**
  - At `max-width: 640px`: reduced `padding-inline` to `var(--space-sm)`; `.nav-bar__logout` and `.nav-bar__avatar` get `min-height: 44px` and `min-width: 44px`.
- **sidebar.css**
  - At `max-width: 640px` (when horizontal pills): `.sidebar__link` gets `min-height: 44px` and increased padding (`0.75rem 0.85rem`); `.sidebar__list` uses `flex-wrap: wrap` and `gap: var(--space-sm)` so pills wrap on narrow screens instead of overflowing.

### Components

- **confirm-action-modal**
  - Covered above (stacked actions, 44px buttons).

### Feature modals and forms

- **assignments.css**
  - At `max-width: 640px`: modal panel padding and modal actions spacing; action buttons full width (stacking already at 820px).
- **teachers-management.css**
  - At `max-width: 640px`: `.tm-modal__actions` stacks (column), `.tm-modal__btn` full width and `min-height: 44px`; `.tm__top-actions` buttons `min-height: 44px`.
- **quizzes.css**
  - At `max-width: 640px`: `.qz__details-action-btn`, `.qz__delete-btn`, `.qz__generate-btn`, `.qz__refresh-btn` get `min-height: 44px`; panel padding already at 0.75rem.
- **stats.css**
  - At `max-width: 640px`: `.st__header` padding `var(--space-sm)`; `.st__chip` and `.st__action-btn` `min-height: 44px`.
- **settings.css**
  - At `max-width: 640px`: `.st__actions button` `min-height: 44px`.
- **plans-manager.css**
  - At `max-width: 640px`: `.pm__filter-actions` and `.pm__export-actions` single column; `.pm__btn` full width and `min-height: 44px`.
- **control-curriculum.css**
  - At `max-width: 640px`: `.cc__filters` and `.cc__summary-grid article` padding set to `var(--space-sm)`.
- **teacher-curriculum-manager.css**
  - At `max-width: 640px`: `.tcm2__form-actions` stacks (column), buttons full width and `min-height: 44px`; `.tcm2__panel-head button` `min-height` and `min-width: 44px`.

### Pages

- **control-dashboard.css**
  - At `max-width: 640px`: `.cd__hero` padding reduced to `var(--space-md) var(--space-lg)`; `.cd__stat-card` padding to `var(--space-md)`.
- **lesson-creator.css**
  - At `max-width: 640px`: `.lcp__preview`, `.lcp__controls`, `.lcp__header` padding set to `var(--space-sm)`.
- **lesson-plan-document-view.css**
  - At `max-width: 640px`: `.lpdv__traditional-card` and `.lpdv__traditional-shell` padding set to `var(--space-sm)`.
- **refinements (smart-refinement-panel.css)**
  - At `max-width: 640px`: mode toggle, proposal/revision and form buttons `min-height: 44px`; form textarea/select `min-height: 2.75rem`.
- **auth.css**
  - At `max-width: 480px`: `.auth__form-wrap` padding set to `var(--space-md)` for very small viewports.

---

## Audit summary

### What was done

- **Touch targets:** All primary buttons, nav items (logout, avatar, sidebar links), modal actions, chips, and feature-specific buttons have at least 44px height (and width where appropriate) on viewports ≤640px.
- **Layout:** No new horizontal overflow introduced. Main content padding tuned at 480px; hero and cards use reduced padding on mobile; filters and form actions stack or single-column at 640px/760px where needed.
- **Modals:** Confirm, assignments, teachers, and TCM modals stack action buttons on narrow screens and use full-width, 44px-high buttons where applicable.
- **Tables:** All table wrappers use `max-width: 100%` and `-webkit-overflow-scrolling: touch`; table content still scrolls horizontally inside the wrapper without breaking the page.
- **Long text:** Card titles and key headings have `overflow-wrap: break-word` / `word-break: break-word` on mobile to avoid layout blow-out.
- **Navigation:** NavBar and Sidebar get smaller padding and 44px tap targets on mobile; sidebar pills wrap when needed.

### Remaining limitations

- **Tables:** Data tables remain horizontal-scroll on mobile (no card-style row layout). Scroll is contained and touch-friendly. Optional future work: mobile card view or reduced `min-width` on very small viewports.
- **Settings vs Stats:** Both use `.st` prefix in separate CSS files; selectors are distinct (e.g. `.st__actions` in settings, `.st__action-btn` in stats). No overlap introduced.
- **Manual QA:** Recommend testing on real devices at 320px, 360px, 375px, 390px, 414px in both RTL and LTR, and checking long titles, empty states, and validation errors.

### Files modified

| Area     | File |
|----------|-----|
| Global   | `src/index.css` |
| Layout   | `src/components/layout/app-layout.css`, `nav-bar.css`, `sidebar.css` |
| Common   | `src/components/common/confirm-action-modal.css` |
| Features | `src/features/assignments/assignments.css`, `quizzes/quizzes.css`, `teachers-management/teachers-management.css`, `stats/stats.css`, `settings/settings.css`, `plans-manager/plans-manager.css`, `control-curriculum/control-curriculum.css`, `control-dashboard/control-dashboard.css`, `teacher-curriculum-manager/teacher-cirriculum-manager.css`, `lesson-creator/lesson-creator.css`, `lesson-plans/components/lesson-plan-document-view.css`, `refinements/components/smart-refinement-panel.css`, `auth/auth.css` |

All changes are scoped to `max-width: 640px` or `480px` media queries; desktop and tablet behavior is unchanged.
