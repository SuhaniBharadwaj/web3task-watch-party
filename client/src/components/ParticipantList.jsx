import React from 'react';

function ParticipantList({
  participants,
  currentUserId,
  currentUserRole,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost
}) {
  const isHost = currentUserRole === 'host';

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'host':
        return { backgroundColor: '#ffe0b2', color: '#e65100', border: '1px solid #ffcc80' };
      case 'moderator':
        return { backgroundColor: '#e1bee7', color: '#6a1b9a', border: '1px solid #ce93d8' };
      default:
        return { backgroundColor: '#e0e0e0', color: '#424242', border: '1px solid #d6d6d6' };
    }
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px'
    }}>
      <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Participants</span>
        <span style={{ color: '#666', fontWeight: 'normal' }}>({participants.length})</span>
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          const badgeStyle = getRoleBadgeStyle(p.role);

          return (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: isMe ? '#f1f8e9' : '#fafafa',
                border: isMe ? '1px solid #c5e1a5' : '1px solid #eee'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: isMe ? 'bold' : 'normal', fontSize: '14px' }}>
                    {p.username}
                  </span>
                  {isMe && (
                    <span style={{ fontSize: '11px', color: '#558b2f', marginLeft: '6px', fontWeight: 'bold' }}>
                      (You)
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  ...badgeStyle
                }}>
                  {p.role}
                </span>
              </div>

              {/* Host actions on other participants */}
              {isHost && !isMe && (
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  borderTop: '1px solid #eee',
                  paddingTop: '6px',
                  fontSize: '12px'
                }}>
                  {p.role === 'participant' ? (
                    <button
                      onClick={() => onAssignRole(p.userId, 'moderator')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#7b1fa2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Make Mod
                    </button>
                  ) : (
                    <button
                      onClick={() => onAssignRole(p.userId, 'participant')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#757575',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Dismiss Mod
                    </button>
                  )}

                  {/* Bonus B1: Transfer Host */}
                  {onTransferHost && (
                    <button
                      onClick={() => onTransferHost(p.userId)}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        backgroundColor: '#ef6c00',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Make Host
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveParticipant(p.userId)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#d32f2f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ParticipantList;
