import { useUIStore } from '../store/useUIStore';

// Adapter to maintain API compatibility
export const useNotificationContext = () => {
  const notifications = useUIStore((state) => state.notifications);
  const addNotification = useUIStore((state) => state.addNotification);
  const onMarkNotificationRead = useUIStore((state) => state.markNotificationRead);
  const onClearAllNotifications = useUIStore((state) => state.clearAllNotifications);
  
  // Calculate unread count efficiently
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    addNotification,
    onMarkNotificationRead,
    onClearAllNotifications,
    unreadCount,
  };
};

export const NotificationProvider = ({ children }) => children;