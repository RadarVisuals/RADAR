import { useUIStore } from '../store/useUIStore';

export const useNotificationContext = () => {
  const notifications = useUIStore((state) => state.notifications);
  const addNotification = useUIStore((state) => state.addNotification);
  const markNotificationRead = useUIStore((state) => state.markNotificationRead);
  const clearAllNotifications = useUIStore((state) => state.clearAllNotifications);
  
  // Calculate unread count efficiently
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    addNotification,
    onMarkNotificationRead: markNotificationRead, // Aliased to match old API if needed
    onClearAllNotifications: clearAllNotifications, // Aliased to match old API
    markNotificationRead,
    clearAllNotifications,
    unreadCount,
  };
};