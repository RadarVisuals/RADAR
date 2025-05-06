import { useState, useCallback, useMemo, useEffect } from "react";

const LOCAL_STORAGE_KEY = "axyz_app_notifications";

/**
 * Manages a list of notifications, providing functions to add, remove,
 * mark as read, and clear notifications. It persists the notification state
 * to localStorage to maintain notifications across sessions. It also calculates
 * and provides the count of unread notifications.
 *
 * @param {Array} [initialNotifications=[]] - An optional initial array of notification objects. Primarily used if localStorage is empty or fails.
 * @returns {{
 *   notifications: Array<object>,
 *   addNotification: (notification: Omit<object, 'id'|'timestamp'|'read'> & {id?: string|number, timestamp?: number, read?: boolean}) => void,
 *   markAsRead: (id: string|number) => void,
 *   markAllAsRead: () => void,
 *   removeNotification: (id: string|number) => void,
 *   clearAll: () => void,
 *   unreadCount: number
 * }} An object containing the current notifications array, functions to manage them, and the unread count.
 */
export function useNotifications(initialNotifications = []) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const storedNotifications = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        if (Array.isArray(parsed)) {
          // console.log(`[useNotifications] Loaded ${parsed.length} notifications from localStorage.`); // Removed log
          return parsed;
        }
      }
    } catch (error) {
      // Keep error log for storage issues
      console.error(
        "[useNotifications] Error loading notifications from localStorage:",
        error,
      );
    }
    return Array.isArray(initialNotifications) ? initialNotifications : [];
  });

  // Effect to save notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications));
      // console.log(`[useNotifications] Saved ${notifications.length} notifications to localStorage.`); // Removed log
    } catch (error) {
      // Keep error log for storage issues
      console.error(
        "[useNotifications] Error saving notifications to localStorage:",
        error,
      );
    }
  }, [notifications]);

  /** Adds a new notification to the list, ensuring a unique ID and timestamp. */
  const addNotification = useCallback((notification) => {
    const formattedNotification = {
      id:
        notification.id ||
        `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: notification.timestamp || Date.now(),
      read: notification.read || false,
      ...notification,
    };
    // console.log("[useNotifications] Adding notification:", formattedNotification); // Removed log
    setNotifications((prev) => [formattedNotification, ...prev]); // Prepend
  }, []);

  /** Marks a specific notification as read by its ID. */
  const markAsRead = useCallback((id) => {
    // console.log(`[useNotifications] Marking notification as read: ${id}`); // Removed log
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)),
    );
  }, []);

  /** Marks all current notifications as read. */
  const markAllAsRead = useCallback(() => {
    // console.log("[useNotifications] Marking all as read."); // Removed log
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  }, []);

  /** Removes a specific notification from the list by its ID. */
  const removeNotification = useCallback((id) => {
    // console.log(`[useNotifications] Removing notification: ${id}`); // Removed log
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  /** Removes all notifications from the list. */
  const clearAll = useCallback(() => {
    // console.log("[useNotifications] Clearing all notifications."); // Removed log
    setNotifications([]);
  }, []);

  /** Memoized count of unread notifications. */
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  };
}