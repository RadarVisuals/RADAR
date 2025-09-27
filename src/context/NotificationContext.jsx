// src/context/NotificationContext.jsx
import React, { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNotifications } from '../hooks/useNotifications';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const notificationData = useNotifications();

  const contextValue = useMemo(() => ({
    notifications: notificationData.notifications,
    addNotification: notificationData.addNotification,
    onMarkNotificationRead: notificationData.markAsRead,
    onClearAllNotifications: notificationData.clearAll,
    unreadCount: notificationData.unreadCount,
  }), [notificationData]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
};