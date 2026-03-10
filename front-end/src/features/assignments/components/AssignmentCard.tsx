import { MdAutoAwesome, MdVisibility } from 'react-icons/md';
import type { Assignment } from '../../../types';
import { ASSIGNMENT_TYPE_LABELS } from '../../../types';

interface AssignmentCardProps {
  assignment: Assignment;
  isDetailLoading: boolean;
  isActive: boolean;
  onView: (assignment: Assignment) => void;
  onModify: (assignment: Assignment) => void;
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
  onModify,
}: AssignmentCardProps) {
  return (
    <article className={`asn-card ${isActive ? 'asn-card--active' : ''}`}>
      <div className="asn-card__header">
        <h3 className="asn-card__title">{assignment.name}</h3>
        <span
          className={`asn-card__type asn-card__type--${assignment.type}`}
          title={assignment.type}
        >
          {ASSIGNMENT_TYPE_LABELS[assignment.type]}
        </span>
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
          <MdVisibility aria-hidden />
          {isDetailLoading && isActive ? 'جارٍ تحميل التفاصيل...' : 'عرض الواجب'}
        </button>

        <button
          type="button"
          className="asn-btn asn-btn--ghost"
          onClick={() => onModify(assignment)}
        >
          <MdAutoAwesome aria-hidden />
          تعديل بالذكاء الاصطناعي
        </button>
      </div>
    </article>
  );
}
