// src/hooks/useNotifications.js
import { useState, useCallback, useMemo, useEffect } from "react";

const LOCAL_STORAGE_KEY = "axyz_app_notifications";

/**
 * @typedef {object} NotificationItem
 * @property {string|number} id - Unique identifier for the notification.
 * @property {number} timestamp - Timestamp of when the notification was created or received.
 * @property {boolean} read - Whether the notification has been marked as read.
 * @property {string} [messageFromInput] - Optional: A pre-formatted message if provided directly to addNotification.
 * @property {string} type - Event type (e.g., 'follower_gained', 'lyx_received'). From LSP1EventService.
 * @property {string} [typeId] - The on-chain typeId of the event. From LSP1EventService.
 * @property {string} [sender] - Sender address. From LSP1EventService.
 * @property {string} [value] - Event value. From LSP1EventService.
 * @property {string} [data] - Raw receivedData. From LSP1EventService.
 * @property {object} [decodedPayload] - Decoded payload, e.g., followerAddress. From LSP1EventService.
 * @property {string} [link] - Optional: A URL link associated with the notification (if provided to addNotification).
 */

/**
 * @typedef {object} NotificationInput
 * @property {string} [message] - Optional: A pre-formatted message. If not provided, NotificationItem will generate one.
 * @property {string} type - REQUIRED: Event type from LSP1EventService or a custom type.
 * @property {string} [typeId] - Optional: The on-chain typeId.
 * @property {string} [sender] - Optional: Sender address.
 * @property {string} [value] - Optional: Event value.
 * @property {string} [data] - Optional: Raw receivedData.
 * @property {object} [decodedPayload] - Optional: Decoded payload.
 * @property {string} [link] - Optional: A URL link.
 * @property {string|number} [id] - Optional: Predefined ID.
 * @property {number} [timestamp] - Optional: Predefined timestamp.
 * @property {boolean} [read] - Optional: Initial read status.
 */

/**
 * @typedef {object} NotificationsAPI
 * @property {Array<NotificationItem>} notifications - The current array of notification objects.
 * @property {(notificationInput: NotificationInput) => void} addNotification - Adds a new notification to the list.
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
   * @param {NotificationInput} notificationInput - The notification object to add.
   */
  const addNotification = useCallback((notificationInput) => {
    // The `notificationInput` object is the `eventObj` from LSP1EventService
    // or a custom object if addNotification is called from elsewhere.
    const formattedNotification = {
      // Fields directly from LSP1EventService's eventObj or from custom input
      id: notificationInput.id || `notification_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: notificationInput.timestamp || Date.now(),
      read: notificationInput.read || false,
      type: notificationInput.type, // This is the human-readable eventTypeName
      typeId: notificationInput.typeId, // The on-chain typeId
      sender: notificationInput.sender, // The determined sender/initiator
      value: notificationInput.value,   // The event value
      data: notificationInput.data,     // The raw receivedData
      decodedPayload: notificationInput.decodedPayload, // Contains followerAddress etc.
      
      // Optional fields that might be passed if addNotification is called with a custom object
      messageFromInput: notificationInput.message, // If a pre-formatted message is passed
      link: notificationInput.link,
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