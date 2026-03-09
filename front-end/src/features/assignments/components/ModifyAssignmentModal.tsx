import { useState, type FormEvent } from 'react';
import { MdClose } from 'react-icons/md';
import type { Assignment } from '../../../types';
import type { NormalizedApiError } from '../../../utils/apiErrors';

interface ModifyAssignmentModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  isSubmitting: boolean;
  error: NormalizedApiError | null;
  onClose: () => void;
  onSubmit: (modificationRequest: string) => Promise<void>;
}

export default function ModifyAssignmentModal({
  assignment,
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: ModifyAssignmentModalProps) {
  const [modificationRequest, setModificationRequest] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleClose = () => {
    setModificationRequest('');
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = modificationRequest.trim();
    if (!trimmed) {
      setLocalError('يرجى كتابة طلب تعديل قبل الإرسال.');
      return;
    }

    setLocalError(null);
    await onSubmit(trimmed);
  };

  if (!isOpen || !assignment) {
    return null;
  }

  return (
    <div
      className="asn-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-assignment-title"
    >
      <div className="asn-modal__backdrop" onClick={handleClose} />

      <div className="asn-modal__panel">
        <header className="asn-modal__header">
          <div>
            <h3 id="modify-assignment-title">تعديل الواجب بالذكاء الاصطناعي</h3>
            <p>{assignment.name}</p>
          </div>

          <button
            type="button"
            className="asn-modal__close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="إغلاق نافذة التعديل"
          >
            <MdClose aria-hidden />
          </button>
        </header>

        <form className="asn-modal__form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="assignment-modification-request">طلب التعديل</label>
          <textarea
            id="assignment-modification-request"
            value={modificationRequest}
            onChange={(event) => setModificationRequest(event.target.value)}
            rows={5}
            placeholder="مثال: اجعل الأسئلة أكثر صعوبة للطلبة المتفوقين، وأضف سؤالاً تطبيقيًا جديدًا."
            disabled={isSubmitting}
          />

          {(localError || error?.message) && (
            <div className="asn-inline-error" role="alert">
              {localError || error?.message}
            </div>
          )}

          <div className="asn-modal__actions">
            <button
              type="button"
              className="asn-btn asn-btn--secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="asn-btn asn-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جارٍ تطبيق التعديل...' : 'تطبيق التعديل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
