// src/store/useUIStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const OPEN_ANIMATION_DURATION = 500;
const CLOSE_ANIMATION_DELAY = 500;

export const useUIStore = create(
  persist(
    (set, get) => ({
      // =========================================
      // 1. TOASTS SLICE
      // =========================================
      toasts: [],
      
      addToast: (content, type = 'info', duration = 5000) => {
        const id = Date.now() + Math.random();
        set((state) => ({ 
          toasts: [...state.toasts, { id, content, type, duration }] 
        }));

        if (duration && duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }
      },

      removeToast: (id) => {
        set((state) => ({ 
          toasts: state.toasts.filter((t) => t.id !== id) 
        }));
      },

      // =========================================
      // 2. NOTIFICATIONS SLICE (Persisted)
      // =========================================
      notifications: [],
      
      addNotification: (notificationInput) => {
        const newNotif = {
          id: notificationInput.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: notificationInput.timestamp || Date.now(),
          read: notificationInput.read || false,
          type: notificationInput.type,
          typeId: notificationInput.typeId,
          sender: notificationInput.sender,
          value: notificationInput.value,
          data: notificationInput.data,
          decodedPayload: notificationInput.decodedPayload,
          messageFromInput: notificationInput.message,
          link: notificationInput.link,
        };

        set((state) => ({ 
          notifications: [newNotif, ...state.notifications] 
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) => 
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      clearAllNotifications: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length;
      },

      // =========================================
      // 3. UI PANELS & LAYOUT SLICE
      // =========================================
      isUiVisible: true,
      infoOverlayOpen: false,
      whitelistPanelOpen: false,
      activePanel: null,
      animatingPanel: null,
      activeLayerTab: 'tab1', // 'tab1' = Layer 3 (Top), 'tab2' = Layer 2, 'tab3' = Layer 1
      tokenSelectorOpen: false,

      // Actions
      toggleUiVisibility: () => set((state) => ({ isUiVisible: !state.isUiVisible })),
      
      toggleInfoOverlay: () => set((state) => ({ infoOverlayOpen: !state.infoOverlayOpen })),
      
      setActiveLayerTab: (tab) => set({ activeLayerTab: tab }),

      // Complex Panel Logic with Animations
      openPanel: (panelName) => {
        // Clear any existing panel logic
        set({ animatingPanel: panelName, activePanel: panelName });
        
        // Simple timeout to clear "animating" status after slide-in
        setTimeout(() => {
          set({ animatingPanel: null });
        }, OPEN_ANIMATION_DURATION);
      },

      closePanel: () => {
        set({ animatingPanel: 'closing' });
        
        setTimeout(() => {
          set({ activePanel: null, animatingPanel: null, tokenSelectorOpen: false });
        }, CLOSE_ANIMATION_DELAY);
      },

      togglePanel: (panelName) => {
        const { activePanel, closePanel, openPanel } = get();
        const cleanName = panelName === "null" ? null : panelName;
        
        if (activePanel === cleanName) {
          closePanel();
        } else {
          openPanel(cleanName);
        }
      },
      
      getActiveLayerId: () => {
        const tab = get().activeLayerTab;
        const map = { tab1: 3, tab2: 2, tab3: 1 };
        return map[tab] || 3;
      }
    }),
    {
      name: 'axyz_app_notifications', // Matches your old localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        notifications: state.notifications // Only persist notifications!
      }),
    }
  )
);