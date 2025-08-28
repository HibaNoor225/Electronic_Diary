const UserNotification = require('../Models/userNotification');

// 📩 Get all notifications for logged-in user
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await UserNotification.find({ user: req.info.id })
     .populate('sender', 'username email profilePhoto')
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// ✅ Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    await UserNotification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// ✅ Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    await UserNotification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// 📌 Create a new notification (used in chat/invite/tag controllers)
exports.createNotification = async (userId, senderId, type, message) => {
  try {
    await UserNotification.create({
      user: userId,
      sender: senderId,
      type,
      message
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;  // <-- correct
    console.log("🗑️ Delete request for notification id:", id);

    const notification = await UserNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
