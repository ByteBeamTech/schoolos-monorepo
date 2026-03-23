import { create } from 'zustand';

export interface TransportRoute { id: string; name: string; vehicleNumber?: string; driverName?: string; driverPhone?: string; feeAmount: number; status: string; _count?: { assignments: number } }
export interface TransportAssignment { id: string; studentId: string; routeId: string; boardingStop?: string; student: { firstName: string; lastName: string; admissionNumber: string } }

interface TransportStore {
  routes:      TransportRoute[];
  selectedRoute: TransportRoute | null;
  assignments: TransportAssignment[];
  setRoutes:   (routes: TransportRoute[]) => void;
  selectRoute: (route: TransportRoute)   => void;
  setAssignments:(a: TransportAssignment[]) => void;
}

export const useTransportStore = create<TransportStore>((set) => ({
  routes: [], selectedRoute: null, assignments: [],
  setRoutes:    (routes)      => set({ routes }),
  selectRoute:  (selectedRoute) => set({ selectedRoute }),
  setAssignments:(assignments) => set({ assignments }),
}));
