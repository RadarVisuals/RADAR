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

      // =========================================
      // 4. NEW: VIDEO MAPPING SLICE
      // =========================================
      isMappingMode: false,
      isMappingUiVisible: true,
      mappingConfig: {
        radius: 35.0,    // Percentage of screen
        feather: 2.0,    // Edge softness percentage
        x: 50.0,         // Center X percentage
        y: 50.0          // Center Y percentage
      },

      toggleMappingMode: () => {
        const currentState = get().isMappingMode;
        const newState = !currentState;
        
        // Auto-fullscreen when entering mode
        if (newState) {
          const root = document.getElementById('fullscreen-root');
          if (root && !document.fullscreenElement) {
            root.requestFullscreen().catch(err => {
              console.warn(`[MappingMode] Fullscreen failed: ${err.message}`);
            });
          }
          // Clear open panels to see the calibration
          get().closePanel();
        }
        
        set({ isMappingMode: newState, isMappingUiVisible: true });
      },

      setMappingUiVisibility: (visible) => set({ isMappingUiVisible: visible }),
      
      updateMappingConfig: (key, value) => set((state) => ({
        mappingConfig: { ...state.mappingConfig, [key]: value }
      })),

      resetMappingConfig: () => set({
        mappingConfig: { radius: 35.0, feather: 2.0, x: 50.0, y: 50.0 }
      }),

      // --- Actions ---
      toggleUiVisibility: () => set((state) => ({ isUiVisible: !state.isUiVisible })),
      
      toggleInfoOverlay: () => set((state) => ({ infoOverlayOpen: !state.infoOverlayOpen })),
      
      setActiveLayerTab: (tab) => set({ activeLayerTab: tab }),

      openPanel: (panelName) => {
        set({ animatingPanel: panelName, activePanel: panelName });
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
      name: 'radar_vj_persistent_config', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        notifications: state.notifications,
        mappingConfig: state.mappingConfig // Persist mapping values
      }),
    }
  )
);