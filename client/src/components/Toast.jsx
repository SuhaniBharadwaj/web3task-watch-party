import React from 'react';

function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '360px'
    }}>
      {toasts.map((toast) => {
        let bgColor = '#323232';
        let borderColor = '#424242';

        if (toast.type === 'error') {
          bgColor = '#d32f2f';
          borderColor = '#b71c1c';
        } else if (toast.type === 'success') {
          bgColor = '#2e7d32';
          borderColor = '#1b5e20';
        } else if (toast.type === 'info') {
          bgColor = '#1976d2';
          borderColor = '#0d47a1';
        }

        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            style={{
              backgroundColor: bgColor,
              border: `1px solid ${borderColor}`,
              color: '#ffffff',
              padding: '12px 16px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.2s ease-in'
            }}
          >
            <span>{toast.message}</span>
            <span style={{ fontSize: '18px', lineHeight: 1, opacity: 0.7 }}>&times;</span>
          </div>
        );
      })}
    </div>
  );
}

export default Toast;
