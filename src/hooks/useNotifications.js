// src/hooks/useNotifications.js
import { useState, useCallback, useMemo, useEffect } from "react";

const LOCAL_STORAGE_KEY = "axyz_app_notifications";

/**
 * @typedef {object} NotificationItem
 * @property {string|number} id - Unique identifier for the notification.
 * @property {number} timestamp - Timestamp of when the notification was created or received.
 * @property {boolean} read - Whether the notification has been marked as read.
 * @property {string} message - The main content/message of the notification.
 * @property {string} [type] - Optional: Type of notification (e.g., 'info', 'warning', 'error').
 * @property {object} [data] - Optional: Any additional data associated with the notification.
 * @property {string} [link] - Optional: A URL link associated with the notification.
 */

/**
 * @typedef {object} NotificationInput
 * @property {string} message - The main content/message of the notification.
 * @property {string} [type] - Optional: Type of notification (e.g., 'info', 'warning', 'error').
 * @property {object} [data] - Optional: Any additional data associated with the notification.
 * @property {string} [link] - Optional: A URL link associated with the notification.
 * @property {string|number} [id] - Optional: Predefined ID. If not provided, one will be generated.
 * @property {number} [timestamp] - Optional: Predefined timestamp. If not provided, `Date.now()` will be used.
 * @property {boolean} [read] - Optional: Initial read status. Defaults to false.
 */

/**
 * @typedef {object} NotificationsAPI
 * @property {Array<NotificationItem>} notifications - The current array of notification objects.
 * @property {(notification: NotificationInput) => void} addNotification - Adds a new notification to the list.
 * @property {(id: string|number) => void} markAsRead - Marks a specific notification as read by its ID.
 * @property {() => void} markAllAsRead - Marks all current notifications as read.
 * @property {(id: string|number) => void} removeNotification - Removes a specific notification from the list by its ID.
 * @property {() => void} clearAll - Removes all notifications from the list.
 * @property {number} unreadCount - The count of unread notifications.
 */

/**
 * Manages a list of notifications, providing functions to add, remove,
 * mark as read, and clear notifications. It persists the notification state
 * to localStorage to maintain notifications across sessions. It also calculates
 * and provides the count of unread notifications.
 *
 * @param {Array<NotificationItem>} [initialNotifications=[]] - An optional initial array of notification objects. Primarily used if localStorage is empty or fails.
 * @returns {NotificationsAPI} An object containing the current notifications array, functions to manage them, and the unread count.
 */
export function useNotifications(initialNotifications = []) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const storedNotifications = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedNotifications) {
        const parsed = JSON.parse(storedNotifications);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[useNotifications] Error loading notifications from localStorage:",
          error,
        );
      }
    }
    return Array.isArray(initialNotifications) ? initialNotifications : [];
  });

  // Effect to save notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[useNotifications] Error saving notifications to localStorage:",
          error,
        );
      }
    }
  }, [notifications]);

  /**
   * Adds a new notification to the list, ensuring a unique ID and timestamp.
   * @param {NotificationInput} notification - The notification object to add.
   */
  const addNotification = useCallback((notification) => {
    const formattedNotification = {
      id:
        notification.id ||
        `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: notification.timestamp || Date.now(),
      read: notification.read || false,
      message: notification.message, // Ensure message is part of the base structure
      type: notification.type,
      data: notification.data,
      link: notification.link,
    };
    setNotifications((prev) => [formattedNotification, ...prev]); // Prepend
  }, []);

  /**
   * Marks a specific notification as read by its ID.
   * @param {string|number} id - The ID of the notification to mark as read.
   */
  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif)),
    );
  }, []);

  /** Marks all current notifications as read. */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  }, []);

  /**
   * Removes a specific notification from the list by its ID.
   * @param {string|number} id - The ID of the notification to remove.
   */
  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  /** Removes all notifications from the list. */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  /** Memoized count of unread notifications. */
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  return useMemo(() => ({
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  }), [
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    unreadCount,
  ]);
}