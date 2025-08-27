// src/components/Panels/NotificationPanel.jsx
import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

import Panel from "./Panel"; // Local component
import { useProfileCache } from "../../hooks/useProfileCache"; // Local hook

import { isAddress } from "viem"; // Third-party utility

import "./PanelStyles/NotificationPanel.css"; // Local styles

/**
 * Formats an Ethereum address for display by showing the beginning and end.
 * Returns "Unknown Address" if the input is invalid.
 * @param {string | null | undefined} address - The address string.
 * @param {number} [length=6] - The number of characters to show from the start and end.
 * @returns {string} The formatted address or "Unknown Address".
 */
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
 * @typedef {object} Notification
 * @property {string|number} id - Unique ID of the notification.
 * @property {string} type - Type of the event (e.g., 'lyx_received', 'follower_gained').
 * @property {string} sender - Address of the transaction sender or relevant party.
 * @property {object} [decodedPayload] - Additional decoded data, e.g., `followerAddress`.
 * @property {number} [timestamp] - Timestamp of the notification.
 * @property {boolean} [read] - Whether the notification has been marked as read.
 * @property {string|React.ReactNode} [content] - Custom content if not using default message generation.
 */

/**
 * @typedef {object} NotificationItemProps
 * @property {Notification} notification - The notification object to display.
 * @property {(id: string|number) => void} [onMarkAsRead] - Callback function to mark the notification as read.
 */

/**
 * NotificationItem: Displays a single notification.
 * It resolves sender and follower addresses to profile names using `useProfileCache`
 * for better readability. Allows marking as read on click.
 *
 * @param {NotificationItemProps} props - The component's props.
 * @returns {JSX.Element} The rendered NotificationItem component.
 */
const NotificationItem = ({ notification, onMarkAsRead }) => {
  const { getCachedProfile, getProfileData } = useProfileCache();
  const itemLogPrefix = `[NotifItem ID:${String(notification.id).slice(-5)} Type:${notification.type}]`;


  const [senderName, setSenderName] = useState(() => {
    const initialName = notification.sender ? formatAddress(notification.sender) : "Unknown Sender";
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} Initial senderName set to: ${initialName}`);
    return initialName;
  });

  const [followerName, setFollowerName] = useState(() => {
      const addr = notification.decodedPayload?.followerAddress;
      const initialName = addr && isAddress(addr) ? formatAddress(addr) : null;
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} Initial followerName set to: ${initialName} (from followerAddress: ${addr})`);
      return initialName;
  });

  // Effect to fetch and update sender's profile name
  useEffect(() => {
    const senderAddress = notification.sender;
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER effect. Address: ${senderAddress}`);

    if (senderAddress && isAddress(senderAddress)) {
      const cachedProfile = getCachedProfile(senderAddress);
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER cachedProfile for ${senderAddress}:`, cachedProfile);

      if (cachedProfile?.name) {
        setSenderName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setSenderName(`Error (${formatAddress(senderAddress, 4)})`);
      } else {
        // Set a default/loading state immediately
        const initialName = formatAddress(senderAddress);
        setSenderName(initialName);
        if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER no cache, set name to default: ${initialName}`);
        
        // Then, initiate the async fetch
        getProfileData(senderAddress).then((profileData) => {
          if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER getProfileData response for ${senderAddress}:`, profileData);
          if (profileData?.name) {
            setSenderName(profileData.name);
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} SENDER setSenderName from FETCH: ${profileData.name}`);
          }
          // If fetch fails or returns no name, the formatted address remains.
        }).catch(err => {
            if(import.meta.env.DEV) console.error(`${itemLogPrefix} SENDER Error in getProfileData promise for ${senderAddress}:`, err);
        });
      }
    } else {
      setSenderName("Unknown Sender");
    }
  }, [notification.sender, getProfileData, getCachedProfile]);

  // Effect to fetch and update follower's profile name
  useEffect(() => {
    const followerAddr = notification.decodedPayload?.followerAddress;
    const isFollowerEvent = notification.type === "follower_gained" || notification.type === "follower_lost";
    if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER effect. Address: ${followerAddr}, isFollowerEvent: ${isFollowerEvent}`);

    if (isFollowerEvent && followerAddr && isAddress(followerAddr)) {
      const cachedProfile = getCachedProfile(followerAddr);
      if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER cachedProfile for ${followerAddr}:`, cachedProfile);

      if (cachedProfile?.name) {
        setFollowerName(cachedProfile.name);
      } else if (cachedProfile?.error) {
        setFollowerName(`Error (${formatAddress(followerAddr, 4)})`);
      } else {
        // Set default/loading state
        const initialName = formatAddress(followerAddr);
        setFollowerName(initialName);
        if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER no cache, set name to default: ${initialName}`);
        
        // Then fetch
        getProfileData(followerAddr).then((profileData) => {
          if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER getProfileData response for ${followerAddr}:`, profileData);
          if (profileData?.name) {
            setFollowerName(profileData.name);
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER setFollowerName from FETCH: ${profileData.name}`);
          }
          // If no name, the formatted address remains.
        }).catch(err => {
            if(import.meta.env.DEV) console.error(`${itemLogPrefix} FOLLOWER Error in getProfileData promise for ${followerAddr}:`, err);
            const errorName = `Error (${formatAddress(followerAddr, 4)})`;
            if (import.meta.env.DEV) console.log(`${itemLogPrefix} FOLLOWER setFollowerName to FETCH ERROR: ${errorName}`);
            setFollowerName(errorName);
        });
      }
    } else {
      // Not a follower event or no valid address
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
    const currentFollowerName = followerName || "Someone"; // Use "Someone" if followerName is null/empty

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
      aria-label={`Notification: ${typeof displayMessage === 'string' ? displayMessage : 'Event details'}. Status: ${notification.read ? 'Read' : 'Unread'}.`}
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
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.string.isRequired,
    sender: PropTypes.string,
    decodedPayload: PropTypes.object,
    timestamp: PropTypes.number,
    read: PropTypes.bool,
    content: PropTypes.node,
  }).isRequired,
  onMarkAsRead: PropTypes.func,
};

const MemoizedNotificationItem = React.memo(NotificationItem);


/**
 * @typedef {object} NotificationPanelProps
 * @property {Array<Notification>} [notifications=[]] - Array of notification objects to display.
 * @property {() => void} onClose - Callback function to close the panel.
 * @property {(id: string|number) => void} [onMarkAsRead] - Callback to mark a notification as read.
 * @property {() => void} [onClearAll] - Callback to clear all notifications.
 */

/**
 * NotificationPanel: Displays a list of notifications.
 * @param {NotificationPanelProps} props - The component's props.
 * @returns {JSX.Element} The rendered NotificationPanel component.
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
          disabled={notifications.length === 0 || typeof onClearAll !== 'function'}
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

export default React.memo(NotificationPanel);