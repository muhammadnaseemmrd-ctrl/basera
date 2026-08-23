const buildWaitlistEntry = ({ user, room }) => ({
  userId: user?._id || user?.id,
  roomId: room?._id || room?.id,
  joinedAt: new Date().toISOString(),
  notifyOnVacancy: true
});

const waitlistMessage = (room) => {
  const roomName = room?.title || room?.roomNumber || "this room";
  return `You joined the waitlist for ${roomName}. You will be notified when a bed becomes available.`;
};

module.exports = { buildWaitlistEntry, waitlistMessage };
