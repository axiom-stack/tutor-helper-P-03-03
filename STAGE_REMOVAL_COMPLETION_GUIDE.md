# STAGE REMOVAL - COMPLETION GUIDE

## ✅ COMPLETED (Automated)

### Database

- ✅ Migration 018: `back-end/sql/migrations/018_remove_stage_from_classes.sql` - Drops stage column from Classes
- ✅ Migration 019: `back-end/sql/migrations/019_remove_educational_stage_from_profiles.sql` - Drops educational_stage from UserProfiles
- ✅ Updated `back-end/sql/master.sql` - Removed stage & educational_stage definitions

### Backend Core

- ✅ `back-end/src/utils/education.js` - Removed: normalizeStage(), validateStageAndGrade(), deriveStageFromGradeLabel(), GRADE_TO_STAGE_MAP, PRIMARY_STAGES
- ✅ `back-end/src/exams/requestModel.js` - Removed stage validation & normalizeStage import
- ✅ `back-end/src/stats/requestModel.js` - Removed stage filtering logic
- ✅ `back-end/src/controllers/assignments.controller.js` - Removed normalizeStage import & stage query handling
- ✅ `back-end/src/controllers/classes.controller.js` - Removed stage derivation, validation, storage, & filtering
- ✅ `back-end/src/controllers/lessons.controller.js` - Removed stage filtering logic from both endpoints
- ✅ `back-end/src/controllers/units.controller.js` - Removed stage filtering logic from both endpoints
- ✅ `back-end/src/controllers/subject.controller.js` - Removed stage filtering logic from both endpoints
- ✅ `back-end/src/controllers/lessonPlans.controller.js` - Removed stage query param handling

### Backend Repositories

- ✅ `back-end/src/exams/repositories/exams.repository.js` - Removed stage filtering
- ✅ `back-end/src/lesson-plans/repositories/lessonPlans.repository.js` - Removed stage filtering
- ✅ `back-end/src/assignments/repositories/assignments.repository.js` - Removed stage filtering

### Backend Export/Views

- ✅ `back-end/src/export/examViewModel.js` - Removed stage field from export model

### Backend Tests

- ✅ `back-end/test/users.controller.test.js` - Removed educational_stage from test fixtures
- ✅ `back-end/test/users.repository.test.js` - Removed educational_stage from test mocks (3 instances)
- ✅ `back-end/test/exams.requestModel.test.js` - Removed stage validation test

### Frontend Core

- ✅ Deleted `front-end/src/context/StageContext.tsx`
- ✅ Deleted `front-end/src/constants/education.ts`
- ✅ Updated `front-end/src/App.tsx` - Removed StageProvider import & wrapping
- ✅ Updated `front-end/src/types/index.ts` - Removed educational_stage from UserProfile types

---

## 🔄 REMAINING MANUAL FIXES

All of the following are **straightforward find-and-replace operations**. Each file needs removal of useStage hook and related stage-based logic.

### Frontend Components - Remove useStage and Stage UI

#### 1. **`front-end/src/components/layout/Sidebar.tsx`**

- Remove line: `import { useStage } from '../../context/StageContext';`
- Remove lines: `const { activeStage, setActiveStage } = useStage();`
- Remove lines: `const profileStages = parseStages(user?.profile?.educational_stage ?? '');` and related filter logic
- Remove the entire stage selector div block (lines that render stage pills like "ابتدائي", "اعدادي", "ثانوي")

#### 2. **`front-end/src/components/layout/MobileNavDrawer.tsx`**

- Remove line: `import { useStage } from '../../context/StageContext';`
- Remove lines: `const { activeStage, setActiveStage } = useStage();`
- Remove the entire stage selector section (aria-checked, onClick stage handlers, stage pills rendering)

#### 3. **Remove CSS Classes**

- **`front-end/src/components/layout/sidebar.css`** - Delete all lines with `.sidebar__stage*` classes (lines ~24-57)
- **`front-end/src/components/layout/mobile-nav-drawer.css`** - Delete all lines with `.mobile-drawer__stage*` classes (lines ~103-136)

### Frontend Features - Remove useStage Hook Usage

#### 4. **`front-end/src/features/assignments/Assignments.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove usage of `activeStage` in queries (if any filtering)

#### 5. **`front-end/src/features/quizzes/Quizzes.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove usage of `activeStage` in filtering/queries

#### 6. **`front-end/src/features/control-curriculum/ControlCurriculum.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove/simplify stage-based filtering in `getScopedClasses` and `getScopedSubjects` calls

#### 7. **`front-end/src/features/teacher-dashboard/TeacherDashboard.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove stage filtering from data fetches

#### 8. **`front-end/src/features/admin-dashboard/AdminDashboard.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove stage from any metric calculations or filters

#### 9. **`front-end/src/features/plans-manager/PlansManager.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove `stage: activeStage` from query parameters in API calls

#### 10. **`front-end/src/features/teacher-curriculum-manager/TeacherCirriculumManager.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove stage from filtering/query logic

#### 11. **`front-end/src/features/stats/Stats.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove `stage: activeStage` from query parameters

#### 12. **`front-end/src/features/control-dashboard/ControlDashboard.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove stage filtering from stats/metrics

#### 13. **`front-end/src/features/lesson-creator/LessonCreator.tsx`**

- Remove: `import { useStage } from '../../context/StageContext';`
- Remove: `const { activeStage } = useStage();`
- Remove stage filtering if present

#### 14. **`front-end/src/features/teachers-management/TeachersManagement.tsx`**

- Remove: `import { getAllowedStages, type StageId } from '../../constants/education';`
- Remove function: `parseStages(value: string): StageId[]` (lines ~65-78)
- Remove function: `formatStagesForStorage(stages: StageId[]): string` (lines ~84-87)
- Remove entire stage management UI section from the teacher edit/create form
- Remove columns displaying `educational_stage` from the teachers table
- Remove stage checkbox logic for toggling stages
- Search for all references to `educational_stage`, `parseStages`, `formatStagesForStorage`, `getAllowedStages` and remove them

#### 15. **`front-end/src/features/assignments/assignments.services.ts`**

- Remove: `import { GRADE_TO_STAGE_MAP } from '../../constants/education';`
- Remove any stage-based filtering logic that uses `GRADE_TO_STAGE_MAP`

### Backend Documentation

#### 16. **`back-end/API_ROUTE_GUIDE.md`**

Search for all `"stage": string | null,` references and remove those lines:

- Line ~129: Stage in assignment creation request
- Line ~144: Stage in assignment creation response
- Line ~174: Stage in exams response
- Line ~203: Stage in exam blueprint
- Line ~234: Stage in assignment data
- Line ~260: Stage in list exams query
- Line ~274: Stage in list exam results
- Line ~305: Stage in exam API response

#### 17. **`back-end/BACKEND_QA_AUDIT.md`**

- Line ~57: Update UserProfiles documentation to remove educational_stage
- Line ~58: Update Classes documentation to remove stage column

---

## 📋 VALIDATION CHECKLIST

After completing all manual fixes, run these commands:

```bash
# Check for remaining stage references (should be minimal - only unrelated ones)
grep -r "stage" back-end/src --include="*.js" | grep -v "ensureLlmSuccess\|stageName\|// " | wc -l

# Check frontend
grep -r "stage\|Stage\|STAGE" front-end/src --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l

# Run tests
cd back-end && npm test

# Build frontend (if applicable)
cd front-end && npm run build
```

---

## 🎯 Key Points

1. **Stage column removed from Classes table** - Classes identified purely by grade_label
2. **educational_stage removed from UserProfiles** - Teachers' context determined by their assigned classes
3. **All filtering by stage removed** - APIs no longer accept or use stage parameters
4. **Stage selector UI removed** - No more toggle between ابتدائي/اعدادي/ثانوي in UI
5. **StageContext completely deleted** - React context entirely removed
6. **education.ts constants deleted** - Stage-related constants no longer exist

---

## 📝 Notes

- Stage UI was providing a way for teachers to filter by educational level across the app
- Now all filtering must be based on the Classes table alone
- Teachers can still organize by classes which have grade_label
- If you need level-based organization in the future, it should be based on grade_label directly, not a separate stage concept
