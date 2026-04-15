import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUIStore = create(
  persist(
    (set) => ({
      isChatOpen: false,
      chatWidth:  420,
      setChatOpen:  (v) => set({ isChatOpen: v }),
      setChatWidth: (v) => set({ chatWidth: v }),

      paletteOpen:    false,
      setPaletteOpen: (v) => set({ paletteOpen: v }),

      activeEmpId:     null,
      isInactiveView:  false,
      openEmployeeSheet:  (empId, isInactive = false) => set({ activeEmpId: empId, isInactiveView: isInactive }),
      closeEmployeeSheet: () => set({ activeEmpId: null, isInactiveView: false }),

      isNewEmployeeSheetOpen:    false,
      setNewEmployeeSheetOpen:   (v) => set({ isNewEmployeeSheetOpen: v }),

      sideSheetWidth:    700,
      setSideSheetWidth: (v) => set({ sideSheetWidth: v }),
    }),
    {
      name:        'ems-ui-storage',
      partialize:  (state) => ({ chatWidth: state.chatWidth, sideSheetWidth: state.sideSheetWidth }),
    }
  )
)
