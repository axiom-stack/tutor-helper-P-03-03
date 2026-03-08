import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  MdFolderSpecial,
  MdAddBox,
  MdUploadFile,
  MdFilterList,
  MdExpandMore,
  MdChevronRight,
  MdDelete,
  MdArticle,
  MdPostAdd,
  MdCloudUpload,
  MdInfoOutline,
  MdCreateNewFolder,
  MdAdd,
  MdPictureAsPdf,
  MdDescription,
  MdAutorenew,
  MdCheckCircle,
  MdErrorOutline,
  MdWarningAmber,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import {
  getMyClasses,
  getMySubjects,
  getUnitsBySubject,
  getLessonsByUnit,
  createUnit,
  createLessonText,
  createLessonFile,
  deleteUnit,
  deleteLesson,
  type CreateLessonFileResponse,
} from './teacher-curriculum-manager.services';
import type { Class, Subject, Unit, Lesson } from '../../types';
import './teacher-cirriculum-manager.css';

type TabId = 'structure' | 'add' | 'upload';
type UploadStatus = 'processing' | 'success' | 'partial' | 'failed';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'word';
  status: UploadStatus;
  message: string;
  contentLength?: number;
}

function getUploadStatusLabel(status: UploadStatus) {
  if (status === 'success') return 'تم الاستخراج';
  if (status === 'partial') return 'استخراج جزئي';
  if (status === 'failed') return 'فشل الاستخراج';
  return 'جارٍ المعالجة...';
}

function getUploadStatusClassName(status: UploadStatus) {
  if (status === 'success') return 'tcm__file-status--success';
  if (status === 'partial') return 'tcm__file-status--partial';
  if (status === 'failed') return 'tcm__file-status--failed';
  return 'tcm__file-status--processing';
}

function getUploadStatusIcon(status: UploadStatus) {
  if (status === 'success') {
    return <MdCheckCircle aria-hidden />;
  }

  if (status === 'partial') {
    return <MdWarningAmber aria-hidden />;
  }

  if (status === 'failed') {
    return <MdErrorOutline aria-hidden />;
  }

  return <MdAutorenew className="tcm__spin" aria-hidden />;
}

function TeacherCirriculumManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [uploadUnits, setUploadUnits] = useState<Unit[]>([]);
  const [unitsLessons, setUnitsLessons] = useState<Record<number, Lesson[]>>({});
  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<TabId>('structure');
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structureLoading, setStructureLoading] = useState(false);

  // Add content form
  const [addClassId, setAddClassId] = useState<number | ''>('');
  const [addSubjectId, setAddSubjectId] = useState<number | ''>('');
  const [addUnitName, setAddUnitName] = useState('');
  const [addUnitDesc, setAddUnitDesc] = useState('');
  const [addLessonName, setAddLessonName] = useState('');
  const [addLessonDesc, setAddLessonDesc] = useState('');
  const [addLessonContent, setAddLessonContent] = useState('');
  const [addStep, setAddStep] = useState(1);

  // Upload
  const [uploadClassId, setUploadClassId] = useState<number | ''>('');
  const [uploadSubjectId, setUploadSubjectId] = useState<number | ''>('');
  const [uploadUnitId, setUploadUnitId] = useState<number | ''>('');
  const [uploadLessonName, setUploadLessonName] = useState('');
  const [uploadLessonDesc, setUploadLessonDesc] = useState('');
  const [fileList, setFileList] = useState<UploadedFileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  // Modals
  const [modalAddUnit, setModalAddUnit] = useState(false);
  const [modalAddLesson, setModalAddLesson] = useState(false);
  const [modalUnitName, setModalUnitName] = useState('');
  const [modalUnitDesc, setModalUnitDesc] = useState('');
  const [modalLessonName, setModalLessonName] = useState('');
  const [modalLessonDesc, setModalLessonDesc] = useState('');
  const [modalLessonContent, setModalLessonContent] = useState('');
  const [modalLessonUnitId, setModalLessonUnitId] = useState<number | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const teacherId = user?.id ?? 0;

  function redirectIfNotTeacher() {
    if (!user) navigate('/authentication');
    else if (user.userRole === 'admin') navigate('/admin');
    else if (user.userRole === 'teacher') return;
    else navigate('/teacher');
  }

  useEffect(() => {
    redirectIfNotTeacher();
  }, [user?.userRole, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getMyClasses(), getMySubjects()])
      .then(([classesRes, subjectsRes]) => {
        if (cancelled) return;
        setClasses(classesRes.classes ?? []);
        setSubjects(subjectsRes.subjects ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error ?? 'حدث خطأ أثناء تحميل البيانات');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subjectsForSelectedClass = useMemo(() => {
    if (!selectedClassId) return subjects;
    return subjects.filter((s) => s.class_id === selectedClassId);
  }, [subjects, selectedClassId]);

  const subjectsForAddClass = useMemo(() => {
    if (!addClassId) return [];
    return subjects.filter((s) => s.class_id === addClassId);
  }, [subjects, addClassId]);

  const unitsForUploadSubject = uploadUnits;

  const loadStructure = useCallback(() => {
    if (!selectedSubjectId) return;
    setStructureLoading(true);
    getUnitsBySubject(selectedSubjectId as number)
      .then((res) => {
        setUnits(res.units ?? []);
        const ids = (res.units ?? []).map((u) => u.id);
        setExpandedUnitIds(new Set(ids));
        return Promise.all(
          ids.map((id) =>
            getLessonsByUnit(id).then((r) => ({ id, lessons: r.lessons ?? [] }))
          )
        );
      })
      .then((results) => {
        const map: Record<number, Lesson[]> = {};
        results.forEach(({ id, lessons }) => {
          map[id] = lessons;
        });
        setUnitsLessons(map);
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? 'حدث خطأ أثناء تحميل المنهج');
      })
      .finally(() => setStructureLoading(false));
  }, [selectedSubjectId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const totalLessons = Object.values(unitsLessons).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const toggleUnit = (id: number) => {
    setExpandedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddUnit = () => {
    if (!selectedSubjectId || !modalUnitName.trim() || !teacherId) return;
    setSubmitLoading(true);
    createUnit({
      subject_id: selectedSubjectId as number,
      teacher_id: teacherId,
      name: modalUnitName.trim(),
      description: modalUnitDesc.trim() || '—',
    })
      .then(() => {
        setModalAddUnit(false);
        setModalUnitName('');
        setModalUnitDesc('');
        loadStructure();
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? 'فشل إضافة الوحدة');
      })
      .finally(() => setSubmitLoading(false));
  };

  const handleAddLesson = () => {
    if (!modalLessonUnitId || !modalLessonName.trim() || !teacherId) return;
    setSubmitLoading(true);
    createLessonText({
      unit_id: modalLessonUnitId,
      teacher_id: teacherId,
      name: modalLessonName.trim(),
      description: modalLessonDesc.trim() || '—',
      content: modalLessonContent.trim() || '—',
    })
      .then(() => {
        setModalAddLesson(false);
        setModalLessonName('');
        setModalLessonDesc('');
        setModalLessonContent('');
        setModalLessonUnitId(null);
        loadStructure();
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? 'فشل إضافة الدرس');
      })
      .finally(() => setSubmitLoading(false));
  };

  const handleDeleteUnit = (unitId: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الوحدة؟')) return;
    deleteUnit(unitId)
      .then(loadStructure)
      .catch((err) =>
        setError(err?.response?.data?.error ?? 'فشل حذف الوحدة')
      );
  };

  const handleDeleteLesson = (lessonId: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الدرس؟')) return;
    deleteLesson(lessonId)
      .then(loadStructure)
      .catch((err) =>
        setError(err?.response?.data?.error ?? 'فشل حذف الدرس')
      );
  };

  const handleAddContentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    setSubmitLoading(true);
    const doCreate = async () => {
      let classId = addClassId;
      let subjectId = addSubjectId;
      if (!classId && classes.length > 0) {
        classId = classes[0].id;
        setAddClassId(classId);
      }
      if (!subjectId && addClassId) {
        const sub = subjects.find((s) => s.class_id === addClassId);
        if (sub) {
          subjectId = sub.id;
          setAddSubjectId(subjectId);
        }
      }
      if (addUnitName.trim()) {
        if (!subjectId) throw new Error('اختر المادة أولاً');
        const { unit } = await createUnit({
          subject_id: subjectId as number,
          teacher_id: teacherId,
          name: addUnitName.trim(),
          description: addUnitDesc.trim() || '—',
        });
        if (addLessonName.trim() && unit) {
          await createLessonText({
            unit_id: unit.id,
            teacher_id: teacherId,
            name: addLessonName.trim(),
            description: addLessonDesc.trim() || '—',
            content: addLessonContent.trim() || '—',
          });
        }
      }
    };
    doCreate()
      .then(() => {
        setAddUnitName('');
        setAddUnitDesc('');
        setAddLessonName('');
        setAddLessonDesc('');
        setAddLessonContent('');
        setAddStep(1);
        loadStructure();
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? 'فشل حفظ المحتوى');
      })
      .finally(() => setSubmitLoading(false));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadUnitId || !uploadLessonName.trim() || !teacherId) {
      return;
    }

    const uploadId = `${Date.now()}-${file.name}`;
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');
    const isLegacyDoc =
      file.type === 'application/msword' ||
      file.name.toLowerCase().endsWith('.doc');
    const isDocx =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx');
    const contentType = isPdf ? 'pdf' : isDocx ? 'word' : null;

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError('حجم الملف يتجاوز الحد الأقصى المسموح وهو 25 ميجابايت');
      e.target.value = '';
      return;
    }

    if (isLegacyDoc) {
      setError('ملفات DOC غير مدعومة. يرجى تحويل الملف إلى DOCX أولاً');
      e.target.value = '';
      return;
    }

    if (!contentType) {
      setError('يدعم الملفات PDF أو DOCX فقط');
      e.target.value = '';
      return;
    }

    setError(null);
    setUploading(true);
    setFileList((prev) => [
      {
        id: uploadId,
        name: file.name,
        size: file.size,
        type: contentType,
        status: 'processing',
        message: 'جارٍ استخراج النص من الملف...',
      },
      ...prev,
    ]);

    createLessonFile({
      name: uploadLessonName.trim(),
      description: uploadLessonDesc.trim() || '—',
      unit_id: uploadUnitId as number,
      content_type: contentType,
      teacher_id: teacherId,
      file,
    })
      .then((res: CreateLessonFileResponse) => {
        const nextStatus: UploadStatus =
          res.extractionStatus === 'partial'
            ? 'partial'
            : res.fileProcessed
              ? 'success'
              : 'failed';

        setFileList((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? {
                  ...item,
                  status: nextStatus,
                  message: res.message,
                  contentLength: res.contentLength,
                }
              : item
          )
        );
        setUploadLessonName('');
        setUploadLessonDesc('');

        if (selectedSubjectId && selectedSubjectId === uploadSubjectId) {
          loadStructure();
        }
      })
      .catch((err) => {
        const uploadError =
          err?.response?.data?.error ?? 'فشل رفع الملف ومعالجة المحتوى';

        setError(uploadError);
        setFileList((prev) =>
          prev.map((item) =>
            item.id === uploadId
              ? {
                  ...item,
                  status: 'failed',
                  message: uploadError,
                  contentLength: 0,
                }
              : item
          )
        );
      })
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const loadUploadUnits = useCallback(() => {
    if (!uploadSubjectId) return;
    getUnitsBySubject(uploadSubjectId as number).then((res) =>
      setUploadUnits(res.units ?? [])
    );
  }, [uploadSubjectId]);

  useEffect(() => {
    if (activeTab === 'upload' && uploadSubjectId) loadUploadUnits();
  }, [activeTab, uploadSubjectId, loadUploadUnits]);

  if (user?.userRole !== 'teacher') {
    return null;
  }

  if (loading) {
    return (
      <div className="tcm" dir="rtl">
        <div className="tcm__loading">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="tcm" dir="rtl">
      <nav aria-label="مسار التنقل">
        <ol className="tcm__breadcrumb">
          <li>
            <Link to="/teacher">الرئيسية</Link>
          </li>
          <li className="tcm__breadcrumb-current">المنهج الدراسي</li>
        </ol>
      </nav>
      <h1 className="tcm__title">إدارة المنهج الدراسي</h1>

      <section className="tcm__quick" aria-labelledby="quick-access-heading">
        <h2 id="quick-access-heading" className="tcm__quick-title">
          وصول سريع
        </h2>
        <div className="tcm__quick-grid">
          <button
            type="button"
            className="tcm__quick-card"
            onClick={() => setActiveTab('structure')}
          >
            <div className="tcm__quick-card-icon">
              <MdFolderSpecial aria-hidden />
            </div>
            <div>
              <h3 className="tcm__quick-card-title">عرض هيكل المنهج</h3>
              <p className="tcm__quick-card-desc">
                اختر الصف والمادة ثم اعرض الوحدات والدروس
              </p>
            </div>
          </button>
          <button
            type="button"
            className="tcm__quick-card"
            onClick={() => setActiveTab('add')}
          >
            <div className="tcm__quick-card-icon">
              <MdAddBox aria-hidden />
            </div>
            <div>
              <h3 className="tcm__quick-card-title">إضافة محتوى</h3>
              <p className="tcm__quick-card-desc">
                أضف وحدة أو درس جديد للمنهج
              </p>
            </div>
          </button>
          <button
            type="button"
            className="tcm__quick-card"
            onClick={() => setActiveTab('upload')}
          >
            <div className="tcm__quick-card-icon">
              <MdUploadFile aria-hidden />
            </div>
            <div>
              <h3 className="tcm__quick-card-title">رفع ملفات المنهج</h3>
              <p className="tcm__quick-card-desc">
                ارفع ملفات PDF أو Word لمعالجتها تلقائياً
              </p>
            </div>
          </button>
        </div>
      </section>

      <div className="tcm__tabs">
        <button
          type="button"
          className={`tcm__tab ${activeTab === 'structure' ? 'tcm__tab--active' : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          <MdFolderSpecial />
          هيكل المنهج
        </button>
        <button
          type="button"
          className={`tcm__tab ${activeTab === 'add' ? 'tcm__tab--active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <MdAddBox />
          إضافة محتوى
        </button>
        <button
          type="button"
          className={`tcm__tab ${activeTab === 'upload' ? 'tcm__tab--active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <MdUploadFile />
          رفع الملفات
        </button>
      </div>

      {error && (
        <div className="tcm__error" role="alert">
          {error}
        </div>
      )}

      {activeTab === 'structure' && (
        <div className="tcm__structure">
          <div className="tcm__filter">
            <h3 className="tcm__filter-title">
              <MdFilterList />
              اختر الصف والمادة
            </h3>
            <div className="tcm__filter-group">
              <label className="tcm__filter-label" htmlFor="tcm-class">
                الصف الدراسي
              </label>
              <select
                id="tcm-class"
                className="tcm__filter-select"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(
                    e.target.value ? Number(e.target.value) : ''
                  );
                  setSelectedSubjectId('');
                }}
              >
                <option value="">— اختر الصف —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="tcm__filter-group">
              <label className="tcm__filter-label" htmlFor="tcm-subject">
                المادة الدراسية
              </label>
              <select
                id="tcm-subject"
                className="tcm__filter-select"
                value={selectedSubjectId}
                onChange={(e) =>
                  setSelectedSubjectId(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
              >
                <option value="">— اختر المادة —</option>
                {subjectsForSelectedClass.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="tcm__filter-btn"
              onClick={loadStructure}
              disabled={!selectedSubjectId || structureLoading}
            >
              عرض المنهج
            </button>
          </div>
          <div className="tcm__tree-wrap">
            {structureLoading ? (
              <div className="tcm__loading">جاري التحميل...</div>
            ) : !selectedSubjectId ? (
              <div className="tcm__empty">
                اختر الصف والمادة ثم اضغط «عرض المنهج».
              </div>
            ) : (
              <>
                <div className="tcm__tree-head">
                  <div>
                    <h2 className="tcm__tree-title">
                      هيكل المنهج: {selectedSubject?.name ?? '—'} —{' '}
                      {selectedClass?.name ?? '—'}
                    </h2>
                    <p className="tcm__tree-subtitle">
                      {units.length} وحدة / {totalLessons} درساً
                    </p>
                  </div>
                  <div className="tcm__tree-actions">
                    <button
                      type="button"
                      className="tcm__btn tcm__btn--secondary"
                      onClick={() => setModalAddUnit(true)}
                      disabled={!selectedSubjectId}
                    >
                      <MdCreateNewFolder />
                      إضافة وحدة
                    </button>
                    <button
                      type="button"
                      className="tcm__btn tcm__btn--primary"
                      onClick={() => {
                        setModalLessonUnitId(units[0]?.id ?? null);
                        setModalAddLesson(true);
                      }}
                      disabled={!selectedSubjectId || units.length === 0}
                    >
                      <MdAdd />
                      إضافة درس
                    </button>
                  </div>
                </div>
                <div className="tcm__tree-list">
                  {units.length === 0 ? (
                    <div className="tcm__empty">لا توجد وحدات بعد.</div>
                  ) : (
                    units.map((unit) => {
                      const isExpanded = expandedUnitIds.has(unit.id);
                      const lessonList = unitsLessons[unit.id] ?? [];
                      return (
                        <div
                          key={unit.id}
                          className={`tcm__unit ${isExpanded ? 'tcm__unit--expanded' : 'tcm__unit--collapsed'}`}
                        >
                          <div
                            className="tcm__unit-header"
                            onClick={() => toggleUnit(unit.id)}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' ||
                                e.key === ' '
                              ) {
                                e.preventDefault();
                                toggleUnit(unit.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                          >
                            <div className="tcm__unit-left">
                              <span
                                className="tcm__unit-expand-icon"
                                aria-hidden
                              >
                                {isExpanded ? (
                                  <MdExpandMore />
                                ) : (
                                  <MdChevronRight />
                                )}
                              </span>
                              <span className="tcm__unit-title">
                                {unit.name}
                              </span>
                              <span className="tcm__unit-badge">
                                {lessonList.length} دروس
                              </span>
                            </div>
                            <div
                              className="tcm__unit-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleDeleteUnit(unit.id)}
                                className="tcm__unit-action--delete"
                                aria-label="حذف الوحدة"
                              >
                                <MdDelete />
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="tcm__lessons">
                              {lessonList.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="tcm__lesson-row"
                                >
                                  <div className="tcm__lesson-left">
                                    <MdArticle aria-hidden />
                                    <span className="tcm__lesson-title">
                                      {lesson.name}
                                    </span>
                                  </div>
                                  <div className="tcm__lesson-actions">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteLesson(lesson.id)
                                      }
                                      className="tcm__lesson-action--delete"
                                      aria-label="حذف الدرس"
                                    >
                                      <MdDelete />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="tcm__add-panel">
          <h2 className="tcm__add-title">
            <MdPostAdd />
            إضافة صف / مادة / وحدة / درس
          </h2>
          <div className="tcm__stepper">
            {[
              { step: 1, label: 'الصف الدراسي' },
              { step: 2, label: 'المادة الدراسية' },
              { step: 3, label: 'الوحدة الدراسية' },
              { step: 4, label: 'الدرس' },
            ].map(({ step, label }) => (
              <div key={step} className="tcm__stepper-step">
                <div
                  className={`tcm__stepper-num ${addStep >= step ? 'tcm__stepper-num--active' : 'tcm__stepper-num--inactive'}`}
                >
                  {step}
                </div>
                <span
                  className={`tcm__stepper-label ${addStep >= step ? 'tcm__stepper-label--active' : 'tcm__stepper-label--inactive'}`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          <form
            className="tcm__form"
            onSubmit={handleAddContentSubmit}
          >
            <div className="tcm__form-grid">
              <div className="tcm__form-group">
                <label className="tcm__form-label" htmlFor="add-class">
                  الصف الدراسي
                </label>
                <select
                  id="add-class"
                  className="tcm__form-select"
                  value={addClassId}
                  onChange={(e) => {
                    setAddClassId(
                      e.target.value ? Number(e.target.value) : ''
                    );
                    setAddSubjectId('');
                  }}
                >
                  <option value="">— اختر الصف —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tcm__form-group">
                <label className="tcm__form-label" htmlFor="add-subject">
                  المادة الدراسية
                </label>
                <select
                  id="add-subject"
                  className="tcm__form-select"
                  value={addSubjectId}
                  onChange={(e) =>
                    setAddSubjectId(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                >
                  <option value="">— اختر المادة —</option>
                  {subjectsForAddClass.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tcm__form-group">
                <label className="tcm__form-label" htmlFor="add-unit-name">
                  عنوان الوحدة
                </label>
                <input
                  id="add-unit-name"
                  type="text"
                  className="tcm__form-input"
                  placeholder="مثال: مدخلي إلى المادة"
                  value={addUnitName}
                  onChange={(e) => setAddUnitName(e.target.value)}
                />
              </div>
              <div className="tcm__form-group">
                <label className="tcm__form-label" htmlFor="add-lesson-name">
                  اسم الدرس
                </label>
                <input
                  id="add-lesson-name"
                  type="text"
                  className="tcm__form-input"
                  placeholder="مثال: الدرس الأول"
                  value={addLessonName}
                  onChange={(e) => setAddLessonName(e.target.value)}
                />
              </div>
            </div>
            <div className="tcm__form-group">
              <label className="tcm__form-label" htmlFor="add-lesson-content">
                محتوى الدرس (نص)
              </label>
              <textarea
                id="add-lesson-content"
                className="tcm__form-textarea"
                value={addLessonContent}
                onChange={(e) => setAddLessonContent(e.target.value)}
                placeholder="أضف محتوى الدرس هنا..."
              />
            </div>
            <div className="tcm__form-actions">
              <button
                type="button"
                className="tcm__btn tcm__btn--outline"
                onClick={() => {
                  setAddUnitName('');
                  setAddUnitDesc('');
                  setAddLessonName('');
                  setAddLessonDesc('');
                  setAddLessonContent('');
                }}
              >
                مسح الحقول
              </button>
              <button
                type="submit"
                className="tcm__btn tcm__btn--success"
                disabled={submitLoading}
              >
                حفظ المحتوى
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="tcm__upload-panel">
          <h2 className="tcm__upload-title">
            <MdCloudUpload />
            رفع ملفات المنهج
          </h2>
          <div className="tcm__upload-filters">
            <div className="tcm__form-group">
              <label className="tcm__filter-label">الصف الدراسي</label>
              <select
                className="tcm__filter-select"
                value={uploadClassId}
                onChange={(e) => {
                  setUploadClassId(
                    e.target.value ? Number(e.target.value) : ''
                  );
                  setUploadSubjectId('');
                  setUploadUnitId('');
                }}
              >
                <option value="">— اختر —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="tcm__form-group">
              <label className="tcm__filter-label">المادة</label>
              <select
                className="tcm__filter-select"
                value={uploadSubjectId}
                onChange={(e) => {
                  setUploadSubjectId(
                    e.target.value ? Number(e.target.value) : ''
                  );
                  setUploadUnitId('');
                }}
              >
                <option value="">— اختر —</option>
                {subjects
                  .filter((s) => s.class_id === uploadClassId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          {uploadSubjectId && (
            <>
              <div className="tcm__form-group" style={{ maxWidth: '20rem' }}>
                <label className="tcm__filter-label">الوحدة (لربط الدرس)</label>
                <select
                  className="tcm__filter-select"
                  value={uploadUnitId}
                  onChange={(e) =>
                    setUploadUnitId(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                >
                  <option value="">— اختر الوحدة —</option>
                  {unitsForUploadSubject.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tcm__form-grid" style={{ marginBottom: '1rem' }}>
                <div className="tcm__form-group">
                  <label className="tcm__form-label">اسم الدرس</label>
                  <input
                    type="text"
                    className="tcm__form-input"
                    value={uploadLessonName}
                    onChange={(e) => setUploadLessonName(e.target.value)}
                    placeholder="مثال: الدرس الأول"
                  />
                </div>
                <div className="tcm__form-group">
                  <label className="tcm__form-label">وصف الدرس</label>
                  <input
                    type="text"
                    className="tcm__form-input"
                    value={uploadLessonDesc}
                    onChange={(e) => setUploadLessonDesc(e.target.value)}
                    placeholder="اختياري"
                  />
                </div>
              </div>
            </>
          )}
          {uploadSubjectId && (
            <div
              className="tcm__dropzone"
              onClick={() =>
                document.getElementById('tcm-file-input')?.click()
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  document.getElementById('tcm-file-input')?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                id="tcm-file-input"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={handleFileSelect}
                disabled={
                  !uploadUnitId || !uploadLessonName.trim() || uploading
                }
              />
              <div className="tcm__dropzone-icon">
                <MdCloudUpload aria-hidden />
              </div>
              <p className="tcm__dropzone-text">اسحب وأفلت الملف هنا</p>
              <p className="tcm__dropzone-hint">
                يدعم ملفات PDF و DOCX حتى ٢٥ ميجابايت
              </p>
              <button
                type="button"
                className="tcm__btn tcm__btn--primary"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('tcm-file-input')?.click();
                }}
                disabled={
                  !uploadUnitId || !uploadLessonName.trim() || uploading
                }
              >
                اختر ملفاً من جهازك
              </button>
            </div>
          )}
          {fileList.length > 0 && (
            <>
              <h3 className="tcm__file-list-title">الملفات المرفوعة مؤخراً</h3>
              <div className="tcm__file-list">
                {fileList.map((f) => (
                  <div key={f.id} className="tcm__file-item">
                    <div className="tcm__file-item-left">
                      <div
                        className={`tcm__file-icon ${f.type === 'pdf' ? 'tcm__file-icon--pdf' : 'tcm__file-icon--doc'}`}
                        aria-hidden
                      >
                        {f.type === 'pdf' ? (
                          <MdPictureAsPdf aria-hidden />
                        ) : (
                          <MdDescription aria-hidden />
                        )}
                      </div>
                      <div>
                        <p className="tcm__file-name">{f.name}</p>
                        <p className="tcm__file-meta">
                          {f.type === 'pdf' ? 'PDF' : 'DOCX'} •{' '}
                          {(f.size / 1024 / 1024).toFixed(1)} ميجابايت
                          {typeof f.contentLength === 'number' &&
                          f.contentLength > 0
                            ? ` • ${f.contentLength} حرف`
                            : ''}
                        </p>
                        <p className="tcm__file-note">{f.message}</p>
                      </div>
                    </div>
                    <span
                      className={`tcm__file-status ${getUploadStatusClassName(f.status)}`}
                    >
                      {getUploadStatusIcon(f.status)}
                      {getUploadStatusLabel(f.status)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="tcm__info-box">
            <MdInfoOutline aria-hidden />
            <div>
              <p className="tcm__info-box-title">معالجة المحتوى التلقائية</p>
              <p className="tcm__info-box-text">
                يقوم المساعد الذكي بتحليل ملفات المنهج المرفوعة لاستخراج
                الوحدات والدروس والأهداف التعليمية تلقائياً وبناء هيكل المنهج
                دون تدخل يدوي منك.
              </p>
            </div>
          </div>
        </div>
      )}

      {modalAddUnit && (
        <div
          className="tcm__modal-backdrop"
          onClick={() => !submitLoading && setModalAddUnit(false)}
          role="presentation"
        >
          <div
            className="tcm__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="tcm__modal-title">إضافة وحدة جديدة</h3>
            <div className="tcm__form-group">
              <label className="tcm__form-label">اسم الوحدة</label>
              <input
                type="text"
                className="tcm__form-input"
                value={modalUnitName}
                onChange={(e) => setModalUnitName(e.target.value)}
                placeholder="مثال: الوحدة الأولى"
              />
            </div>
            <div className="tcm__form-group">
              <label className="tcm__form-label">الوصف</label>
              <textarea
                className="tcm__form-textarea"
                value={modalUnitDesc}
                onChange={(e) => setModalUnitDesc(e.target.value)}
                placeholder="اختياري"
                rows={2}
              />
            </div>
            <div className="tcm__modal-actions">
              <button
                type="button"
                className="tcm__btn tcm__btn--outline"
                onClick={() => !submitLoading && setModalAddUnit(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="tcm__btn tcm__btn--primary"
                onClick={handleAddUnit}
                disabled={!modalUnitName.trim() || submitLoading}
              >
                {submitLoading ? 'جاري الحفظ...' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAddLesson && (
        <div
          className="tcm__modal-backdrop"
          onClick={() => !submitLoading && setModalAddLesson(false)}
          role="presentation"
        >
          <div
            className="tcm__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="tcm__modal-title">إضافة درس جديد</h3>
            {units.length > 1 && (
              <div className="tcm__form-group">
                <label className="tcm__form-label">الوحدة</label>
                <select
                  className="tcm__form-select"
                  value={modalLessonUnitId ?? ''}
                  onChange={(e) =>
                    setModalLessonUnitId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="tcm__form-group">
              <label className="tcm__form-label">اسم الدرس</label>
              <input
                type="text"
                className="tcm__form-input"
                value={modalLessonName}
                onChange={(e) => setModalLessonName(e.target.value)}
                placeholder="مثال: الدرس الأول"
              />
            </div>
            <div className="tcm__form-group">
              <label className="tcm__form-label">الوصف</label>
              <input
                type="text"
                className="tcm__form-input"
                value={modalLessonDesc}
                onChange={(e) => setModalLessonDesc(e.target.value)}
                placeholder="اختياري"
              />
            </div>
            <div className="tcm__form-group">
              <label className="tcm__form-label">المحتوى (نص)</label>
              <textarea
                className="tcm__form-textarea"
                value={modalLessonContent}
                onChange={(e) => setModalLessonContent(e.target.value)}
                placeholder="محتوى الدرس..."
                rows={3}
              />
            </div>
            <div className="tcm__modal-actions">
              <button
                type="button"
                className="tcm__btn tcm__btn--outline"
                onClick={() => !submitLoading && setModalAddLesson(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="tcm__btn tcm__btn--primary"
                onClick={handleAddLesson}
                disabled={
                  !modalLessonName.trim() ||
                  !modalLessonUnitId ||
                  submitLoading
                }
              >
                {submitLoading ? 'جاري الحفظ...' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherCirriculumManager;
