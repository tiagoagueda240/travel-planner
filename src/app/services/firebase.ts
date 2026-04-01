import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, updateDoc, query, where, addDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Place, City, Country, Itinerary } from '../models/models';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private firestore: Firestore = inject(Firestore);
  private injector: Injector = inject(Injector); // Guardamos o contexto de injeção da classe

  // --- ITINERÁRIOS ---
  getItineraries(): Observable<Itinerary[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'itineraries');
      return collectionData(ref, { idField: 'id' }) as Observable<Itinerary[]>;
    });
  }

  getItinerary(id: string): Observable<Itinerary> {
    return runInInjectionContext(this.injector, () => {
      const ref = doc(this.firestore, `itineraries/${id}`);
      return docData(ref, { idField: 'id' }) as Observable<Itinerary>;
    });
  }

  async addItinerary(itinerary: Itinerary) {
    return await addDoc(collection(this.firestore, 'itineraries'), itinerary);
  }

  // --- PAÍSES ---
  getCountriesByItinerary(itineraryId: string): Observable<Country[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'countries');
      const q = query(ref, where('itineraryId', '==', itineraryId));
      return collectionData(q, { idField: 'id' }) as Observable<Country[]>;
    });
  }

  getCountry(id: string): Observable<Country> {
    return runInInjectionContext(this.injector, () => {
      const ref = doc(this.firestore, `countries/${id}`);
      return docData(ref, { idField: 'id' }) as Observable<Country>;
    });
  }

  async addCountry(country: Country) {
    return await addDoc(collection(this.firestore, 'countries'), country);
  }

  // --- CIDADES ---
  getCitiesByCountry(countryId: string): Observable<City[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'cities');
      const q = query(ref, where('countryId', '==', countryId));
      return collectionData(q, { idField: 'id' }) as Observable<City[]>;
    });
  }

  getCity(cityId: string): Observable<City> {
    return runInInjectionContext(this.injector, () => {
      const cityRef = doc(this.firestore, `cities/${cityId}`);
      return docData(cityRef, { idField: 'id' }) as Observable<City>;
    });
  }

  async addCity(city: City) {
    return await addDoc(collection(this.firestore, 'cities'), city);
  }

  async updateCityDates(cityId: string, startDate: string, endDate: string) {
    const cityRef = doc(this.firestore, `cities/${cityId}`);
    try { await updateDoc(cityRef, { startDate, endDate }); } catch (error) { console.error(error); }
  }

  // --- LOCAIS (SÍTIOS) ---
  getPlacesByCity(cityId: string): Observable<Place[]> {
    return runInInjectionContext(this.injector, () => {
      const placesRef = collection(this.firestore, 'places');
      const q = query(placesRef, where('cityId', '==', cityId));
      return collectionData(q, { idField: 'id' }) as Observable<Place[]>;
    });
  }

  async updatePlaceDay(placeId: string, day: number | null) {
    const placeDocRef = doc(this.firestore, `places/${placeId}`);
    try { await updateDoc(placeDocRef, { assignedDay: day }); } catch (error) { console.error(error); }
  }

  async addPlace(place: Place) {
    return await addDoc(collection(this.firestore, 'places'), place);
  }

  async updatePlace(placeId: string, data: Partial<Place>) {
    const placeDocRef = doc(this.firestore, `places/${placeId}`);
    try { await updateDoc(placeDocRef, data); } catch (error) { console.error(error); }
  }

  async deletePlace(placeId: string) {
    const placeDocRef = doc(this.firestore, `places/${placeId}`);
    try { await deleteDoc(placeDocRef); } catch (error) { console.error(error); }
  }
}