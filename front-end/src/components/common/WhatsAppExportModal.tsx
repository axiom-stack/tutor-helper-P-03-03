import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MdPhoneIphone, MdComputer, MdInfoOutline } from 'react-icons/md';
import { isMobileDevice } from '../../utils/whatsapp';
import './whatsapp-export-modal.css';

export interface ShareExportOptions {
  format: 'pdf' | 'docx';
}

interface WhatsAppExportModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (options: ShareExportOptions) => void | Promise<void>;
  isExporting?: boolean;
}

export default function WhatsAppExportModal({
  isOpen,
  title = 'تصدير ومشاركة',
  onClose,
  onConfirm,
  isExporting = false,
}: WhatsAppExportModalProps) {
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const mobile = isMobileDevice();

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

        <div className="wa-export__instructions">
          <div className="wa-export__instructions-header">
            <MdInfoOutline aria-hidden />
            <span>ماذا سيحدث؟</span>
          </div>

          {mobile ? (
            <div className="wa-export__instruction-block wa-export__instruction-block--active">
              <MdPhoneIphone className="wa-export__instruction-icon" aria-hidden />
              <div>
                <p className="wa-export__instruction-title">أنت على جهاز محمول</p>
                <ol className="wa-export__steps">
                  <li>سيتم تحويل الملف إلى {format === 'pdf' ? 'PDF' : 'Word'}</li>
                  <li>ستظهر <strong>قائمة المشاركة</strong> على جهازك</li>
                  <li>اختر <strong>واتساب</strong> أو أي تطبيق آخر لإرسال الملف</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="wa-export__instruction-block wa-export__instruction-block--active">
              <MdComputer className="wa-export__instruction-icon" aria-hidden />
              <div>
                <p className="wa-export__instruction-title">أنت على جهاز كمبيوتر</p>
                <ol className="wa-export__steps">
                  <li>سيتم تحميل الملف ({format === 'pdf' ? 'PDF' : 'Word'}) تلقائياً على جهازك</li>
                  <li>
                    افتح{' '}
                    <a
                      href="https://web.whatsapp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      واتساب ويب
                    </a>{' '}
                    أو أي تطبيق مراسلة
                  </li>
                  <li>أرفق الملف المحمّل يدوياً في المحادثة</li>
                </ol>
              </div>
            </div>
          )}

          <p className="wa-export__fallback-note">
            <MdInfoOutline aria-hidden />
            إذا لم تظهر قائمة المشاركة، سيتم تحميل الملف تلقائياً.
          </p>
        </div>

        <div className="wa-export__actions">
          <button
            type="button"
            className="wa-export__btn wa-export__btn--secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="wa-export__btn wa-export__btn--primary"
            onClick={handleSubmit}
            disabled={isExporting}
            aria-busy={isExporting}
          >
            {isExporting && <span className="ui-button-spinner" aria-hidden />}
            {isExporting ? 'جاري التصدير...' : 'تصدير ومشاركة'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
