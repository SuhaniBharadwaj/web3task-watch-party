import React from 'react';

const AVATAR_COLORS = ['#c8a96b', '#7d9b8b', '#bd8271', '#a5a18e', '#82969b', '#bb9c72'];

function getAvatarDetails(username) {
  const name = String(username || '').trim();
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return {
    initial: name.charAt(0).toUpperCase() || '?',
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length]
  };
}

function ParticipantList({
  participants,
  currentUserId,
  currentUserRole,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost
}) {
  const isHost = currentUserRole === 'host';

  return (
    <section className="participants-panel" aria-labelledby="participants-heading">
      <header className="people-heading">
        <h2 id="participants-heading">Participants</h2>
        <span className="people-count">{participants.length}</span>
      </header>

      <div className="people-list">
        {participants.map((p) => {
          const isMe = p.userId === currentUserId;
          const avatar = getAvatarDetails(p.username);

          return (
            <div
              key={p.userId}
              className={`person-row${isMe ? ' is-current-user' : ''}`}
            >
              <div className="person-main">
                <span className="person-avatar" style={{ '--avatar-color': avatar.color }} aria-hidden="true">
                  {avatar.initial}
                </span>
                <div className="person-name-group">
                  <span className="person-name">{p.username}</span>
                  {isMe && (
                    <span className="you-label">
                      (you)
                    </span>
                  )}
                </div>
                <span className={`role-badge role-${p.role}`}>
                  {p.role}
                </span>
              </div>

              {/* Host actions on other participants */}
              {isHost && !isMe && (
                <div className="person-actions">
                  {p.role === 'participant' ? (
                    <button
                      onClick={() => onAssignRole(p.userId, 'moderator')}
                      className="role-action"
                    >
                      Make moderator
                    </button>
                  ) : (
                    <button
                      onClick={() => onAssignRole(p.userId, 'participant')}
                      className="role-action"
                    >
                      Make participant
                    </button>
                  )}

                  {/* Bonus B1: Transfer Host */}
                  {onTransferHost && (
                    <button
                      onClick={() => onTransferHost(p.userId)}
                      className="role-action"
                    >
                      Make Host
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveParticipant(p.userId)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ParticipantList;
