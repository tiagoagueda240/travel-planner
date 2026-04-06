import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  CollectionReference,
  DocumentReference,
  Firestore,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionData,
  collectionGroup,
  deleteDoc,
  doc,
  docData,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Observable, combineLatest, map, of } from 'rxjs';
import { Booking, City, Country, Itinerary, Place, StickyNote } from '../models/models';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private injector: Injector = inject(Injector);

  // --- PATH HELPERS ---
  private countriesRef(itineraryId: string): CollectionReference {
    return collection(this.firestore, `itineraries/${itineraryId}/countries`);
  }
  private countryRef(itineraryId: string, countryId: string): DocumentReference {
    return doc(this.firestore, `itineraries/${itineraryId}/countries/${countryId}`);
  }
  private citiesRef(itineraryId: string, countryId: string): CollectionReference {
    return collection(this.firestore, `itineraries/${itineraryId}/countries/${countryId}/cities`);
  }
  private cityRef(itineraryId: string, countryId: string, cityId: string): DocumentReference {
    return doc(
      this.firestore,
      `itineraries/${itineraryId}/countries/${countryId}/cities/${cityId}`,
    );
  }
  private placesRef(itineraryId: string, countryId: string, cityId: string): CollectionReference {
    return collection(
      this.firestore,
      `itineraries/${itineraryId}/countries/${countryId}/cities/${cityId}/places`,
    );
  }
  private placeRef(
    itineraryId: string,
    countryId: string,
    cityId: string,
    placeId: string,
  ): DocumentReference {
    return doc(
      this.firestore,
      `itineraries/${itineraryId}/countries/${countryId}/cities/${cityId}/places/${placeId}`,
    );
  }

  // --- ITINERÃRIOS ---
  getItineraries(): Observable<Itinerary[]> {
    return runInInjectionContext(this.injector, () => {
      const uid = this.auth.currentUser?.uid;
      const email = this.auth.currentUser?.email;
      if (!uid) return of([]);
      const ref = collection(this.firestore, 'itineraries');
      const ownedQ = query(ref, where('userId', '==', uid));
      const owned$ = collectionData(ownedQ, { idField: 'id' }) as Observable<Itinerary[]>;
      if (!email) return owned$;
      const sharedQ = query(ref, where('collaborators', 'array-contains', email));
      const shared$ = collectionData(sharedQ, { idField: 'id' }) as Observable<Itinerary[]>;
      return combineLatest([owned$, shared$]).pipe(
        map(([owned, shared]) => {
          const ids = new Set(owned.map((i) => i.id));
          return [...owned, ...shared.filter((i) => !ids.has(i.id))];
        }),
      );
    });
  }

  getItinerary(id: string): Observable<Itinerary> {
    return runInInjectionContext(this.injector, () => {
      return docData(doc(this.firestore, `itineraries/${id}`), {
        idField: 'id',
      }) as Observable<Itinerary>;
    });
  }

  async addItinerary(itinerary: Itinerary) {
    const uid = this.auth.currentUser?.uid;
    return await addDoc(collection(this.firestore, 'itineraries'), { ...itinerary, userId: uid });
  }

  async updateItinerary(id: string, data: Partial<Itinerary>): Promise<void> {
    await updateDoc(doc(this.firestore, `itineraries/${id}`), data);
  }

  async deleteItinerary(id: string): Promise<void> {
    // Cascade: remove all sub-collections before deleting the root document.
    // Firestore does not delete sub-collections automatically.
    const [countriesSnap, bookingsSnap, notesSnap] = await Promise.all([
      getDocs(this.countriesRef(id)),
      getDocs(this.bookingsRef(id)),
      getDocs(this.stickyNotesRef(id)),
    ]);
    await Promise.all(countriesSnap.docs.map((d) => this.deleteCountry(id, d.id)));
    await Promise.all([
      ...bookingsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...notesSnap.docs.map((d) => deleteDoc(d.ref)),
    ]);
    await deleteDoc(doc(this.firestore, `itineraries/${id}`));
  }

  // --- PAÃSES ---
  getCountriesByItinerary(itineraryId: string): Observable<Country[]> {
    return runInInjectionContext(this.injector, () => {
      return collectionData(this.countriesRef(itineraryId), {
        idField: 'id',
      }) as Observable<Country[]>;
    });
  }

  getCountry(itineraryId: string, countryId: string): Observable<Country> {
    return runInInjectionContext(this.injector, () => {
      return docData(this.countryRef(itineraryId, countryId), {
        idField: 'id',
      }) as Observable<Country>;
    });
  }

  async addCountry(country: Country) {
    return await addDoc(this.countriesRef(country.itineraryId), country);
  }

  async updateCountry(itineraryId: string, countryId: string, data: Partial<Country>) {
    await updateDoc(this.countryRef(itineraryId, countryId), data);
  }

  // --- CIDADES ---
  getCitiesByCountry(itineraryId: string, countryId: string): Observable<City[]> {
    return runInInjectionContext(this.injector, () => {
      return collectionData(this.citiesRef(itineraryId, countryId), {
        idField: 'id',
      }) as Observable<City[]>;
    });
  }

  getCitiesByItinerary(itineraryId: string): Observable<City[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(
        collectionGroup(this.firestore, 'cities'),
        where('itineraryId', '==', itineraryId),
      );
      return collectionData(q, { idField: 'id' }) as Observable<City[]>;
    });
  }

  /** Filtered by itinerary IDs — safe for Firestore security rules */
  getCitiesForIds(itineraryIds: string[]): Observable<City[]> {
    if (itineraryIds.length === 0) return of([]);
    return runInInjectionContext(this.injector, () => {
      const chunks: Observable<City[]>[] = [];
      for (let i = 0; i < itineraryIds.length; i += 30) {
        const chunk = itineraryIds.slice(i, i + 30);
        const q = query(
          collectionGroup(this.firestore, 'cities'),
          where('itineraryId', 'in', chunk),
        );
        chunks.push(collectionData(q, { idField: 'id' }) as Observable<City[]>);
      }
      return chunks.length === 1 ? chunks[0] : combineLatest(chunks).pipe(map((r) => r.flat()));
    });
  }

  /** Filtered by itinerary IDs — safe for Firestore security rules */
  getPlacesForIds(itineraryIds: string[]): Observable<Place[]> {
    if (itineraryIds.length === 0) return of([]);
    return runInInjectionContext(this.injector, () => {
      const chunks: Observable<Place[]>[] = [];
      for (let i = 0; i < itineraryIds.length; i += 30) {
        const chunk = itineraryIds.slice(i, i + 30);
        const q = query(
          collectionGroup(this.firestore, 'places'),
          where('itineraryId', 'in', chunk),
        );
        chunks.push(collectionData(q, { idField: 'id' }) as Observable<Place[]>);
      }
      return chunks.length === 1 ? chunks[0] : combineLatest(chunks).pipe(map((r) => r.flat()));
    });
  }

  async addCity(city: City) {
    return await addDoc(this.citiesRef(city.itineraryId!, city.countryId), city);
  }

  async updateCity(itineraryId: string, countryId: string, cityId: string, data: Partial<City>) {
    await updateDoc(this.cityRef(itineraryId, countryId, cityId), data);
  }

  // --- LOCAIS (SÃTIOS) ---
  getPlacesByCity(itineraryId: string, countryId: string, cityId: string): Observable<Place[]> {
    return runInInjectionContext(this.injector, () => {
      return collectionData(this.placesRef(itineraryId, countryId, cityId), {
        idField: 'id',
      }) as Observable<Place[]>;
    });
  }

  getPlacesByItinerary(itineraryId: string): Observable<Place[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(
        collectionGroup(this.firestore, 'places'),
        where('itineraryId', '==', itineraryId),
      );
      return collectionData(q, { idField: 'id' }) as Observable<Place[]>;
    });
  }

  async addPlace(place: Place) {
    return await addDoc(this.placesRef(place.itineraryId!, place.countryId!, place.cityId), place);
  }

  async updatePlace(
    itineraryId: string,
    countryId: string,
    cityId: string,
    placeId: string,
    data: Partial<Place>,
  ): Promise<void> {
    await updateDoc(this.placeRef(itineraryId, countryId, cityId, placeId), data);
  }

  async updatePlaceDay(place: Place, day: number | null): Promise<void> {
    await updateDoc(this.placeRef(place.itineraryId!, place.countryId!, place.cityId, place.id!), {
      assignedDay: day,
    });
  }

  async deletePlace(
    itineraryId: string,
    countryId: string,
    cityId: string,
    placeId: string,
  ): Promise<void> {
    await deleteDoc(this.placeRef(itineraryId, countryId, cityId, placeId));
  }

  async deleteCity(itineraryId: string, countryId: string, cityId: string) {
    const placesSnap = await getDocs(this.placesRef(itineraryId, countryId, cityId));
    await Promise.all(placesSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(this.cityRef(itineraryId, countryId, cityId));
  }

  async deleteCountry(itineraryId: string, countryId: string) {
    const citiesSnap = await getDocs(this.citiesRef(itineraryId, countryId));
    await Promise.all(citiesSnap.docs.map((d) => this.deleteCity(itineraryId, countryId, d.id)));
    await deleteDoc(this.countryRef(itineraryId, countryId));
  }

  // --- RESERVAS ---
  private bookingsRef(itineraryId: string): CollectionReference {
    return collection(this.firestore, `itineraries/${itineraryId}/bookings`);
  }
  private bookingRef(itineraryId: string, bookingId: string): DocumentReference {
    return doc(this.firestore, `itineraries/${itineraryId}/bookings/${bookingId}`);
  }

  getBookings(itineraryId: string): Observable<Booking[]> {
    return runInInjectionContext(this.injector, () => {
      return collectionData(this.bookingsRef(itineraryId), {
        idField: 'id',
      }) as Observable<Booking[]>;
    });
  }

  async addBooking(booking: Booking) {
    return await addDoc(this.bookingsRef(booking.itineraryId), booking);
  }

  async updateBooking(itineraryId: string, bookingId: string, data: Partial<Booking>) {
    await updateDoc(this.bookingRef(itineraryId, bookingId), data);
  }

  async deleteBooking(itineraryId: string, bookingId: string) {
    await deleteDoc(this.bookingRef(itineraryId, bookingId));
  }

  // --- STICKY NOTES ---
  private stickyNotesRef(itineraryId: string): CollectionReference {
    return collection(this.firestore, `itineraries/${itineraryId}/stickyNotes`);
  }
  private stickyNoteRef(itineraryId: string, noteId: string): DocumentReference {
    return doc(this.firestore, `itineraries/${itineraryId}/stickyNotes/${noteId}`);
  }

  getStickyNotes(itineraryId: string): Observable<StickyNote[]> {
    return runInInjectionContext(this.injector, () => {
      return collectionData(this.stickyNotesRef(itineraryId), {
        idField: 'id',
      }) as Observable<StickyNote[]>;
    });
  }

  async addStickyNote(note: StickyNote) {
    return await addDoc(this.stickyNotesRef(note.itineraryId), note);
  }

  async updateStickyNote(itineraryId: string, noteId: string, data: Partial<StickyNote>) {
    await updateDoc(this.stickyNoteRef(itineraryId, noteId), data);
  }

  async deleteStickyNote(itineraryId: string, noteId: string) {
    await deleteDoc(this.stickyNoteRef(itineraryId, noteId));
  }

  // --- PARTILHA ---
  getItineraryByShareToken(token: string): Observable<Itinerary | null> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'itineraries');
      const q = query(ref, where('shareToken', '==', token));
      return (collectionData(q, { idField: 'id' }) as Observable<Itinerary[]>).pipe(
        map((results) => (results.length > 0 ? results[0] : null)),
      );
    });
  }

  async generateShareToken(itineraryId: string): Promise<string> {
    const token = this.createToken();
    await updateDoc(doc(this.firestore, `itineraries/${itineraryId}`), { shareToken: token });
    return token;
  }

  async revokeShareToken(itineraryId: string): Promise<void> {
    await updateDoc(doc(this.firestore, `itineraries/${itineraryId}`), { shareToken: null });
  }

  async addCollaborator(itineraryId: string, email: string): Promise<void> {
    await updateDoc(doc(this.firestore, `itineraries/${itineraryId}`), {
      collaborators: arrayUnion(email.toLowerCase().trim()),
    });
  }

  async removeCollaborator(itineraryId: string, email: string): Promise<void> {
    await updateDoc(doc(this.firestore, `itineraries/${itineraryId}`), {
      collaborators: arrayRemove(email.toLowerCase().trim()),
    });
  }

  isOwner(itinerary: Itinerary): boolean {
    return itinerary.userId === this.auth.currentUser?.uid;
  }

  currentUserEmail(): string | null {
    return this.auth.currentUser?.email ?? null;
  }

  private createToken(): string {
    const arr = new Uint8Array(18);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
