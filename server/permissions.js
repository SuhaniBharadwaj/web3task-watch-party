// Permission map defining which actions each role is allowed to perform
const ROLE_PERMISSIONS = {
  host: [
    'play',
    'pause',
    'seek',
    'change_video',
    'assign_role',
    'remove_participant',
    'transfer_host'
  ],
  moderator: [
    'play',
    'pause',
    'seek',
    'change_video'
  ],
  participant: []
};

// Check if a given role is allowed to execute an action
function can(role, action) {
  if (!role || typeof role !== 'string') {
    return false;
  }
  const allowedActions = ROLE_PERMISSIONS[role.toLowerCase()];
  if (!allowedActions) {
    return false;
  }
  return allowedActions.includes(action);
}

module.exports = {
  ROLE_PERMISSIONS,
  can
};
