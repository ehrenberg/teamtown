import { create } from 'zustand';

interface AdminState {
  /** The administration view is open above the office (ADR-0038). */
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
