import { MdVisibility } from 'react-icons/md';
import type { Assignment } from '../../../types';
import { ASSIGNMENT_TYPE_LABELS } from '../../../types';
import { SyncStatusBadge } from '../../../components/common/SyncStatusBadge';
import type { OfflineAssignmentRecord } from '../../../offline/types';

interface AssignmentCardProps {
  assignment: Assignment | OfflineAssignmentRecord;
  isDetailLoading: boolean;
  isActive: boolean;
  onView: (assignment: Assignment | OfflineAssignmentRecord) => void;
}

function toPreviewText(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 220) {
    return normalized;
  }
  return `${normalized.slice(0, 220)}...`;
}

export default function AssignmentCard({
  assignment,
  isDetailLoading,
  isActive,
  onView,
}: AssignmentCardProps) {
  return (
    <article className={`asn-card animate-fadeIn ${isActive ? 'asn-card--active' : ''}`}>
      <div className="asn-card__header">
        <h3 className="asn-card__title">{assignment.name}</h3>
        <div className="asn-card__header-meta">
          {'sync_status' in assignment ? (
            <SyncStatusBadge status={assignment.sync_status} />
          ) : null}
          <span
            className={`asn-card__type asn-card__type--${assignment.type}`}
            title={assignment.type}
          >
            {ASSIGNMENT_TYPE_LABELS[assignment.type]}
          </span>
        </div>
      </div>

      <p className="asn-card__description">
        {assignment.description?.trim() || 'لا يوجد وصف إضافي لهذا الواجب.'}
      </p>

      <p className="asn-card__content-preview">{toPreviewText(assignment.content)}</p>

      <div className="asn-card__actions">
        <button
          type="button"
          className="asn-btn asn-btn--secondary"
          onClick={() => onView(assignment)}
          disabled={isDetailLoading}
        >
          {isDetailLoading && isActive ? (
            <span className="ui-button-spinner" aria-hidden />
          ) : (
            <MdVisibility aria-hidden />
          )}
          {isDetailLoading && isActive ? 'جارٍ تحميل التفاصيل...' : 'عرض الواجب'}
        </button>
      </div>
    </article>
  );
}
