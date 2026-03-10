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
import './smart-refinement-panel.css';

type SelectorOption = {
  value: string;
  label: string;
};

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

function formatDateTimeAr(value: string): string {
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function getStatusLabel(status: RefinementRequestRecord['status']): string {
  switch (status) {
    case 'processing':
      return 'قيد المعالجة';
    case 'pending_approval':
      return 'بانتظار الاعتماد';
    case 'approved':
      return 'معتمد';
    case 'rejected':
      return 'مرفوض';
    case 'failed':
      return 'فشل';
    case 'blocked':
      return 'محجوب';
    case 'no_changes':
      return 'بدون تغييرات';
    default:
      return status;
  }
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
    <section className="srp" dir="rtl">
      <header className="srp__header">
        <h3>
          <MdAutoAwesome aria-hidden />
          {title}
        </h3>
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
        <small>{feedbackText.length}/2000</small>

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

      {error && <div className="srp__error">{error.message}</div>}
      {message && <div className="srp__success">{message}</div>}

      {activeRequest && (
        <article className="srp__request-meta">
          <p>
            الطلب: <strong>{activeRequest.public_id}</strong>
          </p>
          <p>
            الحالة: <strong>{getStatusLabel(activeRequest.status)}</strong>
          </p>
          <p>تاريخ الطلب: {formatDateTimeAr(activeRequest.created_at)}</p>
          {activeRequest.reason_summary && <p>{activeRequest.reason_summary}</p>}
        </article>
      )}

      {activeProposal && (
        <section className="srp__proposal">
          <header>
            <h4>
              <MdCompareArrows aria-hidden />
              مقارنة النسخة الحالية مع المقترحة
            </h4>
          </header>
          <div className="srp__diff-grid">
            <article>
              <h5>الحالية</h5>
              <pre>{JSON.stringify(baseArtifact ?? {}, null, 2)}</pre>
            </article>
            <article>
              <h5>المقترحة</h5>
              <pre>{JSON.stringify(activeProposal.candidate_artifact ?? {}, null, 2)}</pre>
            </article>
          </div>
          <div className="srp__changed-fields">
            <strong>الحقول المتغيرة:</strong>
            {activeProposal.changed_fields.length === 0 ? (
              <p>لا توجد تغييرات.</p>
            ) : (
              <ul>
                {activeProposal.changed_fields.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
            )}
          </div>
          {activeProposal.warnings?.length > 0 && (
            <div className="srp__warnings">
              {activeProposal.warnings.map((warning, index) => (
                <p key={`${warning.code ?? 'warn'}-${index}`}>{warning.message}</p>
              ))}
            </div>
          )}
          {activeProposal.validation_result?.errors?.length > 0 && (
            <div className="srp__validation-errors">
              {activeProposal.validation_result.errors.map((item, index) => (
                <p key={`${item.code ?? 'error'}-${index}`}>{item.message}</p>
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
                <div>
                  <strong>{item.public_id}</strong>
                  <span>{getStatusLabel(item.status)}</span>
                </div>
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
                <div>
                  <strong>v{item.revision_number}</strong>
                  <span>{item.source}</span>
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
    </section>
  );
}
