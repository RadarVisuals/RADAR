import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Panel from "./Panel";
import { useProfileCache } from "../../hooks/useProfileCache";
import { isAddress } from "viem";
import "./PanelStyles/NotificationPanel.css";

// Helper function to format addresses
const formatAddress = (address, length = 6) => {
  if (!address || typeof address !== "string" || !address.startsWith("0x")) {
    return "Unknown Address";
  }
  if (address.length <= length * 2 + 2) {
    return address;
  }
  return `${address.substring(0, length + 2)}...${address.substring(address.length - length)}`;
};

/**
 * NotificationItem: Displays a single notification, resolving sender/follower
 * addresses to profile names using the useProfileCache hook. Allows marking as read on click.
 */
const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getCachedProfile, getProfileData } = useProfileCache();
  const [senderName, setSenderName] = useState(() => formatAddress(notification.sender));
  const [followerName, setFollowerName] = useState(() => {
      const addr = notification.decodedPayload?.followerAddress;
      return addr ? formatAddress(addr) : null;
  });

  // Effect to fetch sender profile name
  useEffect(() => {
    if (notification.sender) {
      const cached = getCachedProfile(notification.sender);
      if (cached?.name && cached.name !== senderName) {
        setSenderName(cached.name);
      } else if (!cached?.name && !cached?.error) {
        getProfileData(notification.sender).then((data) => {
          if (data?.name) setSenderName(data.name);
        });
      } else if (cached?.error && senderName !== cached.name) {
        setSenderName(cached.name);
      }
    } else {
      setSenderName("Unknown Sender");
    }
  }, [notification.sender, getProfileData, getCachedProfile, senderName]);

  // Effect to fetch follower profile name
  useEffect(() => {
    const followerAddr = notification.decodedPayload?.followerAddress;
    const logPrefix = `[NotificationItem Follower Fetch ${notification.id?.slice(-5)}]`;

    if (
      (notification.type === "follower_gained" || notification.type === "follower_lost") &&
      followerAddr &&
      isAddress(followerAddr)
    ) {
      const cached = getCachedProfile(followerAddr);
      if (cached?.name) {
        if (cached.name !== followerName) setFollowerName(cached.name);
      } else if (cached?.error) {
        const errorName = `Error (${formatAddress(followerAddr, 4)})`;
        if (errorName !== followerName) setFollowerName(errorName);
      } else {
        getProfileData(followerAddr).then((data) => {
          if (data?.name) {
            setFollowerName(data.name);
          } else if (data?.error) {
             const errorName = `Error (${formatAddress(followerAddr, 4)})`;
             setFollowerName(errorName);
          } else {
             setFollowerName(formatAddress(followerAddr));
          }
        }).catch(err => {
            console.error(`${logPrefix} Error calling getProfileData for ${followerAddr}:`, err);
            setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
        });
      }
    } else {
      if (followerName !== null) setFollowerName(null);
    }
  }, [
    notification.id,
    notification.type,
    notification.decodedPayload?.followerAddress,
    getCachedProfile,
    getProfileData,
    followerName,
  ]);

  const getEventTypeClass = (eventType) => {
    if (typeof eventType !== "string") return "contract";
    const lower = eventType.toLowerCase();
    if (lower.includes("lyx")) return "lyx";
    if (lower.includes("token")) return "token";
    if (lower.includes("follower")) return "social";
    if (lower.includes("lsp8")) return "token";
    if (lower.includes("lsp7")) return "token";
    return "contract";
  };

  const displayMessage = () => {
    switch (notification.type) {
      case "lyx_received":
        return `Received LYX from ${senderName}`;
      case "follower_gained":
        return `${followerName || "Someone"} started following you`;
      case "follower_lost":
        return `${followerName || "Someone"} unfollowed you`;
      case "lsp7_received":
         return `Received LSP7 Token from ${senderName}`;
      case "lsp8_received":
         return `Received LSP8 NFT from ${senderName}`;
      default: { 
        const typeLabel = (notification.type || "Event")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return `${typeLabel} detected from ${senderName}`;
      } 
    }
  };

  return (
    <div
      className={`notification-item ${!notification.read ? "new" : ""} type-${getEventTypeClass(notification.type)}`}
      onClick={() => onMarkAsRead && onMarkAsRead(notification.id)}
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
        <div className="notification-message">{displayMessage()}</div>
      </div>
    </div>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  onMarkAsRead: PropTypes.func,
};

/**
 * NotificationPanel: Displays a list of notifications received via LSP1 events.
 * Allows marking individual notifications as read or clearing all notifications.
 */
const NotificationPanel = ({
  notifications = [],
  onClose,
  onMarkAsRead,
  onClearAll,
}) => {
  return (
    <Panel
      title="NOTIFICATIONS"
      onClose={onClose}
      className="panel-from-toolbar notification-panel"
    >
      <div className="panel-header-actions">
        <button
          className="btn btn-sm btn-clear-all"
          onClick={onClearAll}
          disabled={notifications.length === 0}
        >
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
              onMarkAsRead={onMarkAsRead}
            />
          ))
        )}
      </div>
    </Panel>
  );
};

NotificationPanel.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.object),
  onClose: PropTypes.func.isRequired,
  onMarkAsRead: PropTypes.func,
  onClearAll: PropTypes.func,
};

export default NotificationPanel;