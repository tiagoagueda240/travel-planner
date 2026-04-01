export interface Itinerary {
  id?: string;
  userId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  collaborators?: string[]; // emails com acesso de edição
  shareToken?: string | null; // token público para leitura (null = não partilhado)
}

export interface Country {
  id?: string;
  itineraryId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
}

export interface City {
  id?: string;
  countryId: string;
  itineraryId?: string;
  name: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
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
}

export interface DateRange {
  startDate: string;
  endDate: string;
}
