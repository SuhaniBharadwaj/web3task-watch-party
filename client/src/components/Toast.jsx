import React from 'react';

function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-layer" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const typeClass = toast.type === 'error'
          ? 'toast-item toast-item--error'
          : toast.type === 'success'
            ? 'toast-item toast-item--success'
            : 'toast-item toast-item--info';

        return (
          <div
            key={toast.id}
            className={typeClass}
            onClick={() => onDismiss(toast.id)}
            role="status"
          >
            <span className="toast-message">{toast.message}</span>
            <span className="toast-close" aria-hidden="true">&times;</span>
          </div>
        );
      })}
    </div>
  );
}

export default Toast;
