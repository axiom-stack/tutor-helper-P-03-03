import { useState, useEffect } from 'react';
import './whatsapp-export-modal.css';

export interface WhatsAppExportOptions {
  format: 'pdf' | 'docx';
  message: string;
}

interface WhatsAppExportModalProps {
  isOpen: boolean;
  title?: string;
  defaultMessage?: string;
  onClose: () => void;
  onConfirm: (options: WhatsAppExportOptions) => void | Promise<void>;
  isExporting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function WhatsAppExportModal({
  isOpen,
  title = 'مشاركة عبر واتساب',
  defaultMessage = '',
  onClose,
  onConfirm,
  isExporting = false,
  confirmLabel = 'تصدير وفتح واتساب',
  cancelLabel = 'إلغاء',
}: WhatsAppExportModalProps) {
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [message, setMessage] = useState(defaultMessage);

  useEffect(() => {
    if (isOpen) {
      setMessage(defaultMessage);
      setFormat('pdf');
    }
  }, [isOpen, defaultMessage]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    void Promise.resolve(onConfirm({ format, message: message.trim() }));
  };

  return (
    <div
      className="wa-export__backdrop"
      role="presentation"
      onClick={() => !isExporting && onClose()}
    >
      <div
        className="wa-export__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="wa-export-title" className="wa-export__title">
          {title}
        </h3>
        <p className="wa-export__hint">
          سيتم تصدير الملف (PDF أو Word) وإرفاقه مع الرسالة في واتساب عند الإمكان، أو تحميله وفتح واتساب ليمكنك إرفاقه يدوياً.
        </p>

        <div className="wa-export__field">
          <label htmlFor="wa-export-format" className="wa-export__label">
            صيغة الملف
          </label>
          <select
            id="wa-export-format"
            className="wa-export__select"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')}
            disabled={isExporting}
          >
            <option value="pdf">PDF</option>
            <option value="docx">Word (DOCX)</option>
          </select>
        </div>

        <div className="wa-export__field">
          <label htmlFor="wa-export-message" className="wa-export__label">
            رسالة اختيارية (ستُضاف إلى واتساب)
          </label>
          <textarea
            id="wa-export-message"
            className="wa-export__textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="مثال: مرفق خطة الدرس / الواجب / الاختبار..."
            rows={4}
            disabled={isExporting}
          />
        </div>

        <div className="wa-export__actions">
          <button
            type="button"
            className="wa-export__btn wa-export__btn--secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="wa-export__btn wa-export__btn--primary"
            onClick={handleSubmit}
            disabled={isExporting}
            aria-busy={isExporting}
          >
            {isExporting && <span className="ui-button-spinner" aria-hidden />}
            {isExporting ? 'جاري التصدير...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
