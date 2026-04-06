import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';

interface RestCountry {
  name: { common: string };
}

export interface PlaceSuggestion {
  name: string;
  kinds: string;
  lat: number;
  lon: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string; tourism?: string; historic?: string; amenity?: string; leisure?: string };
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly http = inject(HttpClient);
  private readonly nominatimBase = 'https://nominatim.openstreetmap.org';
  private readonly overpassBase = 'https://overpass-api.de/api/interpreter';

  private countries$: Observable<string[]> | null = null;

  getCountries(): Observable<string[]> {
    if (!this.countries$) {
      this.countries$ = this.http
        .get<RestCountry[]>('https://restcountries.com/v3.1/all?fields=name,flags')
        .pipe(
          map((list) => list.map((c) => c.name.common).sort((a, b) => a.localeCompare(b, 'pt'))),
          shareReplay(1),
        );
    }
    return this.countries$;
  }

  getCities(countryName: string): Observable<string[]> {
    if (!countryName?.trim()) return of([]);
    return this.http
      .post<{
        error: boolean;
        msg: string;
        data: string[];
      }>('https://countriesnow.space/api/v0.1/countries/cities', { country: countryName })
      .pipe(map((res) => (res.error ? [] : res.data)));
  }

  getCityCoordinates(cityName: string): Observable<{ lat: number; lon: number } | null> {
    const url = `${this.nominatimBase}/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
    return this.http
      .get<NominatimResult[]>(url, {
        headers: { 'Accept-Language': 'pt' },
      })
      .pipe(
        map((res) =>
          res.length > 0 ? { lat: parseFloat(res[0].lat), lon: parseFloat(res[0].lon) } : null,
        ),
        catchError(() => of(null)),
      );
  }

  getPlacesNear(lat: number, lon: number): Observable<PlaceSuggestion[]> {
    const radius = 10000; // 10 km
    const query = `
      [out:json][timeout:20];
      (
        node["tourism"~"museum|attraction|artwork|viewpoint|monument|gallery|theme_park|aquarium|zoo"](around:${radius},${lat},${lon});
        node["historic"~"monument|castle|ruins|fort|memorial|archaeological_site"](around:${radius},${lat},${lon});
        node["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
        way["tourism"~"museum|attraction|monument"](around:${radius},${lat},${lon});
        way["historic"~"monument|castle|ruins|fort"](around:${radius},${lat},${lon});
      );
      out center 30;
    `;
    return this.http
      .post<{ elements: OverpassElement[] }>(this.overpassBase, query, {
        headers: { 'Content-Type': 'text/plain' },
      })
      .pipe(
        map((res) =>
          res.elements
            .filter((e) => !!e.tags?.name)
            .map((e) => {
              const coordLat = e.lat ?? e.center?.lat ?? lat;
              const coordLon = e.lon ?? e.center?.lon ?? lon;
              const tag = e.tags?.tourism ?? e.tags?.historic ?? e.tags?.leisure ?? '';
              return {
                name: e.tags!.name!,
                kinds: tag,
                lat: coordLat,
                lon: coordLon,
              };
            })
            .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i) // dedup
            .slice(0, 30),
        ),
        catchError(() => of([])),
      );
  }

  getPlacesByCity(cityName: string): Observable<PlaceSuggestion[]> {
    return this.getCityCoordinates(cityName).pipe(
      switchMap((coords) => (coords ? this.getPlacesNear(coords.lat, coords.lon) : of([]))),
      catchError(() => of([])),
    );
  }

  searchPlacesByName(query: string): Observable<PlaceSuggestion[]> {
    if (query.trim().length < 3) return of([]);
    const POI_CLASSES = ['tourism', 'historic', 'amenity', 'leisure', 'natural', 'man_made'];
    const url = `${this.nominatimBase}/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=0&dedupe=1`;
    return this.http.get<NominatimResult[]>(url, { headers: { 'Accept-Language': 'pt' } }).pipe(
      map((res) =>
        res
          .filter((r) => POI_CLASSES.includes(r.class))
          .map((r) => ({
            name: r.display_name.split(',')[0].trim(),
            kinds: r.type,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
          })),
      ),
      catchError(() => of([])),
    );
  }

  searchLocation(query: string): Observable<PlaceSuggestion[]> {
    if (query.trim().length < 3) return of([]);
    const url = `${this.nominatimBase}/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=0&dedupe=1`;
    return this.http.get<NominatimResult[]>(url, { headers: { 'Accept-Language': 'pt' } }).pipe(
      map((res) =>
        res.map((r) => ({
          name: r.display_name.split(',').slice(0, 2).join(', ').trim(),
          kinds: r.type,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        })),
      ),
      catchError(() => of([])),
    );
  }

  searchAirports(query: string): Observable<PlaceSuggestion[]> {
    if (query.trim().length < 2) return of([]);
    const url = `${this.nominatimBase}/search?q=${encodeURIComponent(query + ' aeroporto')}&format=json&limit=12&addressdetails=0&dedupe=1`;
    return this.http.get<NominatimResult[]>(url, { headers: { 'Accept-Language': 'pt' } }).pipe(
      map((res) =>
        res
          .filter((r) => r.class === 'aeroway' || r.type === 'aerodrome' || r.type === 'airport')
          .map((r) => ({
            name: r.display_name.split(',').slice(0, 2).join(', ').trim(),
            kinds: r.type,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
          })),
      ),
      catchError(() => of([])),
    );
  }

  searchHotels(query: string): Observable<PlaceSuggestion[]> {
    const ACCOMMODATION_CLASSES = ['tourism', 'amenity', 'building'];
    const ACCOMMODATION_TYPES = [
      'hotel',
      'hostel',
      'motel',
      'guest_house',
      'apartment',
      'chalet',
      'camp_site',
      'caravan_site',
      'resort',
      'spa',
      'inn',
    ];
    if (query.trim().length < 2) return of([]);
    const url = `${this.nominatimBase}/search?q=${encodeURIComponent(query)}&format=json&limit=12&addressdetails=0&dedupe=1`;
    return this.http.get<NominatimResult[]>(url, { headers: { 'Accept-Language': 'pt' } }).pipe(
      map((res) => {
        const filtered = res.filter(
          (r) => ACCOMMODATION_CLASSES.includes(r.class) || ACCOMMODATION_TYPES.includes(r.type),
        );
        // Se o filtro não devolver nada, devolve os primeiros 6 resultados sem filtrar
        const results = filtered.length > 0 ? filtered : res.slice(0, 6);
        return results.map((r) => ({
          name: r.display_name.split(',').slice(0, 2).join(', ').trim(),
          kinds: r.type,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        }));
      }),
      catchError(() => of([])),
    );
  }
}
