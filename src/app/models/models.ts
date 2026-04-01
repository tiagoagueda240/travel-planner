export interface Itinerary {
    id?: string;
    name: string;
    startDate?: string;
    endDate?: string;
    imageUrl?: string;
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
    name: string;
    imageUrl: string;
    link: string;
    assignedDay?: number | null;
    orderIndex?: number;
}