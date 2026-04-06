export interface Itinerary {
  id?: string;
  userId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  collaborators?: string[]; // emails com acesso de edição
  shareToken?: string | null; // token público para leitura (null = não partilhado)
  dayNotes?: Record<string, string>; // keyed by dayNumber (as string)
  budget?: number | null; // orçamento total da viagem
  currency?: string; // moeda base (default 'EUR')
}

export interface Country {
  id?: string;
  itineraryId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  orderIndex?: number;
}

export interface City {
  id?: string;
  countryId: string;
  itineraryId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  orderIndex?: number;
  notes?: string;
}

export interface Place {
  id?: string;
  cityId: string;
  countryId?: string;
  itineraryId?: string;
  name: string;
  imageUrl: string;
  link: string;
  assignedDay?: number | null;
  orderIndex?: number;
  lat?: number | null;
  lon?: number | null;
  cost?: number | null; // custo estimado/real do local (bilhete, entrada, etc.)
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface StickyNote {
  id?: string;
  itineraryId: string;
  text: string;
  assignedDay: number | null;
  color: StickyNoteColor;
  orderIndex?: number;
}

export type DayItem = { type: 'place'; data: Place } | { type: 'note'; data: StickyNote };

export type BookingType = 'flight' | 'hotel' | 'bus' | 'other';

export interface Booking {
  id?: string;
  itineraryId: string;
  type: BookingType;
  title: string;
  airline?: string; // companhia aérea (opcional)
  flightNumber?: string; // número do voo (opcional)
  date?: string; // ISO date YYYY-MM-DD (departure for flight/bus, check-in for hotel)
  time?: string; // HH:MM (departure time for flight/bus)
  arrivalDate?: string; // ISO date YYYY-MM-DD (arrival date for flight/bus)
  arrivalTime?: string; // HH:MM (arrival time for flight/bus)
  departureLocation?: string; // departure airport/station for flight/bus
  arrivalLocation?: string; // arrival airport/station for flight/bus
  endDate?: string; // check-out for hotels
  location?: string;
  locationCity?: string; // cidade/morada do hotel (para geocodificação)
  locationLat?: number;
  locationLon?: number;
  link?: string;
  reference?: string;
  notes?: string;
  cost?: number | null; // custo desta reserva
}
