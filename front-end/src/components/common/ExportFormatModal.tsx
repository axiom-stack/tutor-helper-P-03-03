import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './whatsapp-export-modal.css';

export interface ExportFormatSelection {
  format: 'pdf' | 'docx';
}

interface ExportFormatModalProps {
  isOpen: boolean;
  title?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (selection: ExportFormatSelection) => void | Promise<void>;
  isSubmitting?: boolean;
}

export default function ExportFormatModal({
  isOpen,
  title = 'تصدير',
  confirmLabel = 'تصدير',
  onClose,
  onConfirm,
  isSubmitting = false,
}: ExportFormatModalProps) {
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');

  useEffect(() => {
    if (isOpen) {
      setFormat('pdf');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    void Promise.resolve(onConfirm({ format }));
  };

  return createPortal(
    <div
      className="wa-export__backdrop"
      role="presentation"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="wa-export__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-format-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="export-format-title" className="wa-export__title">
          {title}
        </h3>

        <div className="wa-export__field">
          <label htmlFor="export-format-select" className="wa-export__label">
            صيغة الملف
          </label>
          <select
            id="export-format-select"
            className="wa-export__select"
            value={format}
            onChange={(event) => setFormat(event.target.value as 'pdf' | 'docx')}
            disabled={isSubmitting}
          >
            <option value="pdf">PDF</option>
            <option value="docx">Word (DOCX)</option>
          </select>
        </div>

        <div className="wa-export__actions">
          <button
            type="button"
            className="wa-export__btn wa-export__btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="wa-export__btn wa-export__btn--primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting && <span className="ui-button-spinner" aria-hidden />}
            {isSubmitting ? 'جارٍ التصدير...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
