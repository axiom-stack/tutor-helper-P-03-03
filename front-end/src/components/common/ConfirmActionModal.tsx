import './confirm-action-modal.css';

export interface ConfirmActionContext {
  endpoint: string;
  payload?: Record<string, unknown>;
}

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (context: ConfirmActionContext) => void | Promise<void>;
}

export default function ConfirmActionModal({
  isOpen,
  title,
  message,
  endpoint,
  payload,
  isLoading = false,
  confirmLabel = 'تأكيد الحذف',
  cancelLabel = 'إلغاء',
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="cam__backdrop" role="presentation" onClick={() => !isLoading && onCancel()}>
      <div className="cam__modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="cam__actions">
          <button type="button" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="cam__danger"
            onClick={() => void onConfirm({ endpoint, payload })}
            disabled={isLoading}
          >
            {isLoading && <span className="ui-button-spinner" aria-hidden />}
            {isLoading ? 'جارٍ التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
