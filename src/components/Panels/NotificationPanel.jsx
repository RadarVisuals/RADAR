// src/components/Panels/NotificationPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useProfileCache } from "../../hooks/useProfileCache";
import { useUIStore } from "../../store/useUIStore"; // Updated to use Store
import { isAddress } from "viem";

import "./PanelStyles/NotificationPanel.css";

// --- Helper Functions & Sub-components ---

const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "Unknown Address";
  }
  if (address.length <= length * 2 + 2) {
    return address;
  }
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getCachedProfile, getProfileData } = useProfileCache();
  
  // Initialize state
  const [senderName, setSenderName] = useState(() => {
    return notification.sender ? formatAddress(notification.sender) : "Unknown Sender";
  });

  const [followerName, setFollowerName] = useState(() => {
      const addr = notification.decodedPayload?.followerAddress;
      return addr && isAddress(addr) ? formatAddress(addr) : null;
  });

  // Effect to fetch and update sender's profile name
  useEffect(() => {
    const senderAddress = notification.sender;

    if (senderAddress && isAddress(senderAddress)) {
      const cachedProfile = getCachedProfile(senderAddress);

      if (cachedProfile?.name) {
        setSenderName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setSenderName(`Error (${formatAddress(senderAddress, 4)})`);
      } else {
        const initialName = formatAddress(senderAddress);
        setSenderName(initialName);
        
        getProfileData(senderAddress).then((profileData) => {
          if (profileData?.name) {
            setSenderName(profileData.name);
          }
        }).catch(() => {});
      }
    } else {
      setSenderName("Unknown Sender");
    }
  }, [notification.sender, getProfileData, getCachedProfile]);

  // Effect to fetch and update follower's profile name
  useEffect(() => {
    const followerAddr = notification.decodedPayload?.followerAddress;
    const isFollowerEvent = notification.type === "follower_gained" || notification.type === "follower_lost";

    if (isFollowerEvent && followerAddr && isAddress(followerAddr)) {
      const cachedProfile = getCachedProfile(followerAddr);

      if (cachedProfile?.name) {
        setFollowerName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
      } else {
        const initialName = formatAddress(followerAddr);
        setFollowerName(initialName);
        
        getProfileData(followerAddr).then((profileData) => {
          if (profileData?.name) {
            setFollowerName(profileData.name);
          }
        }).catch(() => {
            setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
        });
      }
    } else {
      setFollowerName(null);
    }
  }, [notification.type, notification.decodedPayload, getProfileData, getCachedProfile]);

  const getEventTypeClass = (eventType) => {
    if (typeof eventType !== "string") return "contract";
    const lower = eventType.toLowerCase();
    if (lower.includes("lyx")) return "lyx";
    if (lower.includes("token") || lower.includes("lsp7") || lower.includes("lsp8")) return "token";
    if (lower.includes("follower")) return "social";
    return "contract";
  };

  const displayMessage = useMemo(() => {
    if (notification.content) return notification.content;
    const currentFollowerName = followerName || "Someone";

    switch (notification.type) {
      case "lyx_received":
        return <>Received LYX from <strong>{senderName}</strong></>;
      case "follower_gained":
        return <>{currentFollowerName} started following you</>;
      case "follower_lost":
        return <>{currentFollowerName} unfollowed you</>;
      case "lsp7_received":
         return <>Received LSP7 Token from <strong>{senderName}</strong></>;
      case "lsp8_received":
         return <>Received LSP8 NFT from <strong>{senderName}</strong></>;
      default: {
        const typeLabel = (notification.type || "Event")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return <>{typeLabel} detected from <strong>{senderName}</strong></>;
      }
    }
  }, [notification.type, notification.content, senderName, followerName]);

  const handleItemClick = () => {
    if (onMarkAsRead && !notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? "new" : ""} type-${getEventTypeClass(notification.type)}`}
      onClick={handleItemClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleItemClick();}}
      aria-live="polite"
      aria-label={`Notification status: ${notification.read ? 'Read' : 'Unread'}`}
    >
      <div className="notification-header">
        <span className="notification-timestamp">
          {notification.timestamp
            ? new Date(notification.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Unknown time"}
        </span>
        <span
          className={`notification-type-tag type-${getEventTypeClass(notification.type)}`}
        >
          {(notification.type || "EVENT").replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="notification-content">
        <div className="notification-message">{displayMessage}</div>
      </div>
    </div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  onMarkAsRead: PropTypes.func,
};

const MemoizedNotificationItem = React.memo(NotificationItem);

// --- Main Component ---

const NotificationPanel = ({ onClose }) => {
  // Use Zustand hooks directly
  const notifications = useUIStore((state) => state.notifications);
  const markNotificationRead = useUIStore((state) => state.markNotificationRead);
  const clearAllNotifications = useUIStore((state) => state.clearAllNotifications);

  return (
    <Panel
      title="NOTIFICATIONS"
      onClose={onClose}
      className="panel-from-toolbar notification-panel"
    >
      <div className="panel-header-actions">
        <button
          className="btn btn-sm btn-clear-all"
          onClick={clearAllNotifications}
          disabled={notifications.length === 0}
          aria-label="Clear all notifications"
        >
          CLEAR ALL
        </button>
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <MemoizedNotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markNotificationRead}
            />
          ))
        )}
      </div>
    </Panel>
  );
};

NotificationPanel.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default React.memo(NotificationPanel);