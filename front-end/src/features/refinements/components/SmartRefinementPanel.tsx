import { useEffect, useMemo, useState } from 'react';
import {
  MdAutoAwesome,
  MdCheckCircle,
  MdCompareArrows,
  MdHistory,
  MdReplay,
  MdThumbDown,
  MdThumbUp,
} from 'react-icons/md';
import type {
  CreateRefinementRequestPayload,
  RefinementArtifactType,
  RefinementProposal,
  RefinementRequestRecord,
} from '../../../types';
import type { NormalizedApiError } from '../../../utils/apiErrors';
import {
  approveRefinement,
  createRefinement,
  listArtifactRevisions,
  listRefinementHistory,
  rejectRefinement,
  retryRefinement,
  revertArtifactRevision,
} from '../refinements.services';
import {
  buildProposalViewModel,
  buildRequestSummary,
  formatDateTimeAr,
  formatInlineValue,
  getDisplayValueLabel,
  getRevisionSourceLabel,
  getStatusLabel,
  getTargetSelectorLabel,
  localizeApiError,
  localizeSuccessMessage,
  type SelectorOption,
} from '../refinementDisplay';
import './smart-refinement-panel.css';

interface SmartRefinementPanelProps {
  artifactType: RefinementArtifactType;
  artifactId?: string;
  assignmentGroupId?: string;
  baseArtifact: Record<string, unknown> | null;
  targetSelectors: SelectorOption[];
  title?: string;
  enableBatchToggle?: boolean;
  defaultMode?: 'single' | 'batch';
  onCommitted?: () => Promise<void> | void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function renderValueContent(path: string, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return <p className="srp__value-empty">لا توجد قيمة</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="srp__value-empty">لا توجد عناصر</p>;
    }

    const allSimple = value.every((item) => item === null || typeof item !== 'object');
    if (allSimple) {
      return (
        <ul className="srp__value-list">
          {value.map((item, index) => (
            <li key={`${path}-${index}`}>{formatInlineValue(`${path}[${index}]`, item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <div className="srp__value-stack">
        {value.map((item, index) => (
          <div key={`${path}-${index}`} className="srp__nested-block">
            <strong>العنصر {index + 1}</strong>
            {renderValueContent(`${path}[${index}]`, item)}
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
    if (entries.length === 0) {
      return <p className="srp__value-empty">لا توجد تفاصيل</p>;
    }

    return (
      <div className="srp__value-fields">
        {entries.map(([key, entryValue]) => {
          const childPath = path ? `${path}.${key}` : key;
          return (
            <div key={childPath} className="srp__value-field-row">
              <span className="srp__value-field-label">{getDisplayValueLabel(childPath)}</span>
              <div className="srp__value-field-content">{renderValueContent(childPath, entryValue)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return <p className="srp__value-text">{formatInlineValue(path, value)}</p>;
}

export default function SmartRefinementPanel({
  artifactType,
  artifactId,
  assignmentGroupId,
  baseArtifact,
  targetSelectors,
  title = 'التحسين الذكي بالملاحظات',
  enableBatchToggle = false,
  defaultMode = 'single',
  onCommitted,
}: SmartRefinementPanelProps) {
  const [mode, setMode] = useState<'single' | 'batch'>(defaultMode);
  const [feedbackText, setFeedbackText] = useState('');
  const [targetSelector, setTargetSelector] = useState(
    targetSelectors[0]?.value ?? 'full_document'
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<RefinementRequestRecord | null>(
    null
  );
  const [activeProposal, setActiveProposal] = useState<RefinementProposal | null>(null);
  const [history, setHistory] = useState<RefinementRequestRecord[]>([]);
  const [revisionList, setRevisionList] = useState<
    Array<{
      id: number;
      revision_number: number;
      source: string;
      is_current: boolean;
      created_at: string;
    }>
  >([]);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (mode === 'batch') {
      return artifactType === 'assignment' && Boolean(assignmentGroupId);
    }
    return Boolean(artifactId);
  }, [artifactId, artifactType, assignmentGroupId, mode]);

  const errorMessages = useMemo(() => localizeApiError(artifactType, error), [artifactType, error]);
  const successMessage = useMemo(() => localizeSuccessMessage(message), [message]);
  const requestSummary = useMemo(() => {
    if (!activeRequest) {
      return null;
    }

    return buildRequestSummary({
      artifactType,
      request: activeRequest,
      proposal: activeProposal,
      targetSelectors,
    });
  }, [activeProposal, activeRequest, artifactType, targetSelectors]);
  const proposalViewModel = useMemo(() => {
    if (!activeProposal) {
      return null;
    }

    return buildProposalViewModel({
      artifactType,
      request: activeRequest,
      proposal: activeProposal,
      baseArtifact,
      targetSelectors,
    });
  }, [activeProposal, activeRequest, artifactType, baseArtifact, targetSelectors]);

  const loadHistory = async () => {
    if (!canSubmit) return;

    const filters =
      mode === 'batch'
        ? { artifact_type: artifactType, assignment_group_id: assignmentGroupId }
        : { artifact_type: artifactType, artifact_id: artifactId };

    const response = await listRefinementHistory(filters);
    setHistory(response.refinements ?? []);
  };

  const loadRevisions = async () => {
    if (!artifactId || mode !== 'single') {
      setRevisionList([]);
      return;
    }
    const response = await listArtifactRevisions({
      artifact_type: artifactType,
      artifact_id: artifactId,
      limit: 20,
    });
    setRevisionList(
      (response.revisions ?? []).map((item) => ({
        id: item.id,
        revision_number: item.revision_number,
        source: item.source,
        is_current: item.is_current,
        created_at: item.created_at,
      }))
    );
  };

  useEffect(() => {
    void loadHistory().catch(() => {
      // no-op
    });
    void loadRevisions().catch(() => {
      // no-op
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactType, artifactId, assignmentGroupId, mode]);

  useEffect(() => {
    setTargetSelector(targetSelectors[0]?.value ?? 'full_document');
  }, [targetSelectors]);

  const handleCreateRefinement = async () => {
    if (!feedbackText.trim() || !canSubmit) {
      return;
    }

    const payload: CreateRefinementRequestPayload = {
      artifact_type: artifactType,
      target_mode: mode,
      feedback_text: feedbackText.trim(),
      target_selector: targetSelector || undefined,
      include_alternatives: false,
      ...(mode === 'single'
        ? { artifact_id: artifactId }
        : { assignment_group_id: assignmentGroupId }),
    };

    setIsCreating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await createRefinement(payload);
      setActiveRequest(response.refinement_request);
      setActiveProposal(response.proposal);
      setMessage('تم إنشاء مقترح التحسين.');
      await loadHistory();
      await loadRevisions();
    } catch (err: unknown) {
      setError(err as NormalizedApiError);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetry = async () => {
    if (!activeRequest) return;
    setIsDecisionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await retryRefinement(activeRequest.public_id);
      setActiveRequest(response.refinement_request);
      setActiveProposal(response.proposal);
      setMessage('تمت إعادة محاولة التحسين.');
      await loadHistory();
      await loadRevisions();
    } catch (err: unknown) {
      setError(err as NormalizedApiError);
    } finally {
      setIsDecisionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!activeRequest) return;
    setIsDecisionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await approveRefinement(activeRequest.public_id, {
        expected_base_revision_ids: activeRequest.base_revision_ids,
      });
      setActiveRequest(response.refinement_request);
      setMessage('تم اعتماد التحسين وتحديث المستند.');
      await loadHistory();
      await loadRevisions();
      await onCommitted?.();
    } catch (err: unknown) {
      setError(err as NormalizedApiError);
    } finally {
      setIsDecisionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activeRequest) return;
    setIsDecisionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await rejectRefinement(activeRequest.public_id, {});
      setActiveRequest(response.refinement_request);
      setMessage('تم رفض المقترح مع إبقاء المحتوى الأصلي.');
      await loadHistory();
    } catch (err: unknown) {
      setError(err as NormalizedApiError);
    } finally {
      setIsDecisionLoading(false);
    }
  };

  const handleRevert = async (revisionId: number) => {
    if (!artifactId || mode !== 'single') {
      return;
    }
    const accepted = window.confirm('هل تريد استرجاع هذه النسخة؟');
    if (!accepted) {
      return;
    }

    setIsDecisionLoading(true);
    setError(null);
    setMessage(null);
    try {
      await revertArtifactRevision({
        artifact_type: artifactType,
        artifact_id: artifactId,
        target_revision_id: revisionId,
        reason: 'manual revert',
      });
      setMessage('تم استرجاع النسخة بنجاح.');
      await loadRevisions();
      await onCommitted?.();
    } catch (err: unknown) {
      setError(err as NormalizedApiError);
    } finally {
      setIsDecisionLoading(false);
    }
  };

  const isPendingApproval = activeRequest?.status === 'pending_approval';

  return (
    <section className="srp">
      <header className="srp__header">
        <div>
          <h3>
            <MdAutoAwesome aria-hidden />
            {title}
          </h3>
          <p>اعرض الفرق الحقيقي فقط، ثم قرر اعتماد التعديل أو رفضه.</p>
        </div>
        {enableBatchToggle && artifactType === 'assignment' && (
          <div className="srp__mode-toggle">
            <button
              type="button"
              className={mode === 'single' ? 'is-active' : ''}
              onClick={() => setMode('single')}
            >
              عنصر واحد
            </button>
            <button
              type="button"
              className={mode === 'batch' ? 'is-active' : ''}
              onClick={() => setMode('batch')}
            >
              مجموعة
            </button>
          </div>
        )}
      </header>

      <div className="srp__form-card">
        <div className="srp__form">
          <label htmlFor={`srp-feedback-${artifactType}`}>ملاحظات المعلم</label>
          <textarea
            id={`srp-feedback-${artifactType}`}
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="مثال: اجعل الأهداف أكثر قابلية للقياس، ووضّح صياغة الأسئلة."
            disabled={!canSubmit || isCreating || isDecisionLoading}
          />
          <div className="srp__form-meta">
            <small>{feedbackText.length}/2000</small>
          </div>

          <label htmlFor={`srp-target-${artifactType}`}>نطاق التعديل</label>
          <select
            id={`srp-target-${artifactType}`}
            value={targetSelector}
            onChange={(event) => setTargetSelector(event.target.value)}
            disabled={!canSubmit || isCreating || isDecisionLoading}
          >
            {targetSelectors.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="srp__primary-btn"
            onClick={() => void handleCreateRefinement()}
            disabled={!canSubmit || !feedbackText.trim() || isCreating || isDecisionLoading}
          >
            <MdAutoAwesome aria-hidden />
            {isCreating ? 'جارٍ توليد المقترح...' : 'توليد مقترح تحسين'}
          </button>
        </div>
      </div>

      {errorMessages.length > 0 && (
        <div className="srp__error" role="alert">
          {errorMessages.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      {successMessage && <div className="srp__success">{successMessage}</div>}

      {activeRequest && (
        <article className="srp__request-meta">
          <div className="srp__request-top">
            <div>
              <p className="srp__eyebrow">طلب التحسين</p>
              <strong>{activeRequest.public_id}</strong>
            </div>
            <span className={`srp__status-chip srp__status-chip--${activeRequest.status}`}>
              {getStatusLabel(activeRequest.status)}
            </span>
          </div>

          <div className="srp__request-grid">
            <div>
              <span>النطاق</span>
              <strong>
                {getTargetSelectorLabel(
                  artifactType,
                  activeRequest.target_selector,
                  targetSelectors
                )}
              </strong>
            </div>
            <div>
              <span>تاريخ الطلب</span>
              <strong>{formatDateTimeAr(activeRequest.created_at)}</strong>
            </div>
            {proposalViewModel && (
              <div>
                <span>عدد التغييرات</span>
                <strong>{proposalViewModel.changeCountLabel}</strong>
              </div>
            )}
          </div>

          {requestSummary && <p className="srp__request-summary">{requestSummary}</p>}
        </article>
      )}

      {activeProposal && proposalViewModel && (
        <section className="srp__proposal">
          <header className="srp__proposal-header">
            <div>
              <h4>
                <MdCompareArrows aria-hidden />
                المقترح الحالي
              </h4>
              <p>{proposalViewModel.summary}</p>
            </div>
            <div className="srp__proposal-badges">
              <span>{proposalViewModel.scopeLabel}</span>
              <span>{proposalViewModel.changeCountLabel}</span>
            </div>
          </header>

          {proposalViewModel.groups.length === 0 ? (
            <div className="srp__proposal-empty">
              <p>لا توجد فروقات قابلة للعرض في هذا المقترح.</p>
            </div>
          ) : (
            <div className="srp__diff-groups">
              {proposalViewModel.groups.map((group) => (
                <section key={group.key} className="srp__diff-group">
                  <header className="srp__diff-group-header">
                    <div>
                      <h5>{group.label}</h5>
                      {group.description && <p>{group.description}</p>}
                    </div>
                    <span>{group.items.length} عناصر</span>
                  </header>

                  <div className="srp__diff-list">
                    {group.items.map((item) => (
                      <article key={item.key} className="srp__diff-card">
                        <header className="srp__diff-card-header">
                          <div>
                            <h6>{item.label}</h6>
                            {item.hint && <p>{item.hint}</p>}
                          </div>
                        </header>

                        <div className="srp__value-compare">
                          <section className="srp__value-column">
                            <span className="srp__value-side-label">قبل</span>
                            {renderValueContent(item.path, item.before)}
                          </section>
                          <section className="srp__value-column srp__value-column--after">
                            <span className="srp__value-side-label srp__value-side-label--after">
                              بعد
                            </span>
                            {renderValueContent(item.path, item.after)}
                          </section>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {proposalViewModel.warnings.length > 0 && (
            <div className="srp__notice srp__notice--warning">
              {proposalViewModel.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          {proposalViewModel.validationErrors.length > 0 && (
            <div className="srp__notice srp__notice--error">
              {proposalViewModel.validationErrors.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}

          <div className="srp__proposal-actions">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={isDecisionLoading || isCreating || !activeRequest}
            >
              <MdReplay aria-hidden />
              إعادة التوليد
            </button>
            <button
              type="button"
              className="srp__approve-btn"
              onClick={() => void handleApprove()}
              disabled={!isPendingApproval || isDecisionLoading || isCreating}
            >
              <MdThumbUp aria-hidden />
              اعتماد
            </button>
            <button
              type="button"
              className="srp__reject-btn"
              onClick={() => void handleReject()}
              disabled={!isPendingApproval || isDecisionLoading || isCreating}
            >
              <MdThumbDown aria-hidden />
              رفض
            </button>
          </div>
        </section>
      )}

      <div
        className={`srp__secondary-grid${
          mode === 'single' && revisionList.length > 0 ? '' : ' srp__secondary-grid--single'
        }`}
      >
        <section className="srp__history">
          <h4>
            <MdHistory aria-hidden />
            سجل طلبات التحسين
          </h4>
          {history.length === 0 ? (
            <p>لا توجد طلبات سابقة.</p>
          ) : (
            <ul>
              {history.map((item) => (
                <li key={item.public_id}>
                  <div className="srp__history-head">
                    <strong>{item.public_id}</strong>
                    <span className={`srp__status-chip srp__status-chip--${item.status}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                  <span className="srp__history-scope">
                    {getTargetSelectorLabel(artifactType, item.target_selector, targetSelectors)}
                  </span>
                  <p>{item.feedback_text}</p>
                  <small>{formatDateTimeAr(item.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        {mode === 'single' && revisionList.length > 0 && (
          <section className="srp__revisions">
            <h4>
              <MdCheckCircle aria-hidden />
              تاريخ النسخ (مع الاسترجاع)
            </h4>
            <ul>
              {revisionList.map((item) => (
                <li key={item.id}>
                  <div className="srp__revision-head">
                    <strong>الإصدار {item.revision_number}</strong>
                    <span>{getRevisionSourceLabel(item.source)}</span>
                    {item.is_current && <span className="srp__current-tag">الحالية</span>}
                  </div>
                  <small>{formatDateTimeAr(item.created_at)}</small>
                  <button
                    type="button"
                    disabled={item.is_current || isDecisionLoading}
                    onClick={() => void handleRevert(item.id)}
                  >
                    استرجاع هذه النسخة
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
