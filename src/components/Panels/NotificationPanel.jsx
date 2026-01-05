// src/components/Panels/NotificationPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel";
import { useProfileCache } from "../../hooks/useProfileCache";
import { useUIStore } from "../../store/useUIStore"; 
import { isAddress } from "viem";

import "./PanelStyles/NotificationPanel.css";

// --- Helper Functions ---

const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "Unknown";
  }
  if (address.length <= length * 2 + 2) return address;
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getProfileData } = useProfileCache();
  const updateNotification = useUIStore((s) => s.updateNotification);
  
  // 1. Initial State: 
  // Priority 1: Already resolved name from LocalStorage
  // Priority 2: Formatted 0x address (Preventing "Loading..." string flicker)
  const [senderName, setSenderName] = useState(() => {
    return notification.resolvedSenderName || (notification.sender ? formatAddress(notification.sender) : "Unknown Sender");
  });

  const [followerName, setFollowerName] = useState(() => {
    const addr = notification.decodedPayload?.followerAddress;
    return notification.resolvedFollowerName || (addr && isAddress(addr) ? formatAddress(addr) : null);
  });

  // 2. Fetch Sender Name (if not already baked into the notification)
  useEffect(() => {
    if (notification.resolvedSenderName) return;

    const senderAddress = notification.sender;
    if (senderAddress && isAddress(senderAddress)) {
      getProfileData(senderAddress).then((profileData) => {
        // Only proceed if we get a real name, ignoring the "Loading..." cache placeholder
        if (profileData?.name && profileData.name !== "Loading...") {
          setSenderName(profileData.name);
          // Persist the name to the store/LocalStorage
          updateNotification(notification.id, { resolvedSenderName: profileData.name });
        }
      }).catch(() => {});
    }
  }, [notification.sender, notification.id, notification.resolvedSenderName, getProfileData, updateNotification]);

  // 3. Fetch Follower Name (if applicable and not baked)
  useEffect(() => {
    if (notification.resolvedFollowerName) return;

    const followerAddr = notification.decodedPayload?.followerAddress;
    const isFollowerEvent = notification.type === "follower_gained" || notification.type === "follower_lost";

    if (isFollowerEvent && followerAddr && isAddress(followerAddr)) {
      getProfileData(followerAddr).then((profileData) => {
        if (profileData?.name && profileData.name !== "Loading...") {
          setFollowerName(profileData.name);
          // Persist to store/LocalStorage
          updateNotification(notification.id, { resolvedFollowerName: profileData.name });
        }
      }).catch(() => {});
    }
  }, [notification.type, notification.decodedPayload, notification.id, notification.resolvedFollowerName, getProfileData, updateNotification]);

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
        return <><strong>{currentFollowerName}</strong> started following you</>;
      case "follower_lost":
        return <><strong>{currentFollowerName}</strong> unfollowed you</>;
      case "lsp7_received":
         return <>Received LSP7 Token from <strong>{senderName}</strong></>;
      case "lsp8_received":
         return <>Received LSP8 NFT from <strong>{senderName}</strong></>;
      default: {
        const typeLabel = (notification.type || "Event")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return <>{typeLabel} from <strong>{senderName}</strong></>;
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
    >
      <div className="notification-header">
        <span className="notification-timestamp">
          {notification.timestamp ? new Date(notification.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
        </span>
        <span className={`notification-type-tag type-${getEventTypeClass(notification.type)}`}>
          {(notification.type || "EVENT").replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="notification-content">
        <div className="notification-message">{displayMessage}</div>
      </div>
    </div>
  );
};

const NotificationPanel = ({ onClose }) => {
  const notifications = useUIStore((state) => state.notifications);
  const markNotificationRead = useUIStore((state) => state.markNotificationRead);
  const clearAllNotifications = useUIStore((state) => state.clearAllNotifications);

  return (
    <Panel title="NOTIFICATIONS" onClose={onClose} className="panel-from-toolbar notification-panel">
      <div className="panel-header-actions">
        <button className="btn btn-sm btn-clear-all" onClick={clearAllNotifications} disabled={notifications.length === 0}>
          CLEAR ALL
        </button>
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">No notifications yet.</div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
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