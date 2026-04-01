import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Place } from '../../../models/models';

export interface MapPlace extends Place {
  dayNumber?: number | null;
  dayLabel?: string;
  color?: string;
}

// Paleta de cores por dia (extensível)
const DAY_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#d946ef',
  '#0ea5e9',
  '#a3e635',
  '#fb923c',
  '#e879f9',
];

function dayColor(day: number | null | undefined): string {
  if (!day) return '#9ca3af';
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
}

function buildIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
    html: `
      <div style="
        width:32px;height:40px;
        display:flex;flex-direction:column;
        align-items:center;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.28));
      ">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};
          color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-size:0.7rem;font-weight:800;
          border:2.5px solid #fff;
        ">${label}</div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:8px solid ${color};
          margin-top:-1px;
        "></div>
      </div>`,
  });
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  template: ` <div class="map-shell">
    <div #mapEl class="map-el"></div>
    <div class="map-no-coords" *ngIf="visible && noCoords">
      <span>📍</span>
      <p>Nenhum local tem coordenadas ainda.<br />Usa o autocomplete do Nome para as adicionar.</p>
    </div>
  </div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .map-shell {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 340px;
      }
      .map-el {
        width: 100%;
        height: 100%;
        min-height: 340px;
        border-radius: 16px;
        z-index: 0;
      }
      .map-no-coords {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
        border-radius: 16px;
        gap: 8px;
        color: #9ca3af;
        text-align: center;
        font-size: 0.875rem;
        line-height: 1.5;
        span {
          font-size: 2rem;
        }
      }
    `,
  ],
})
export class MapViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  @Input() places: MapPlace[] = [];
  @Input() visible = false;

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  noCoords = false;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (this.visible) this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && !this.map) {
      setTimeout(() => this.initMap(), 0);
    }
    if (this.map) this.refreshMarkers();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapEl.nativeElement, {
        zoom: 12,
        center: [38.716, -9.139], // Lisboa como default
        zoomControl: true,
        attributionControl: true,
      });

      // Tile layer CartoDB Positron — minimalista e moderno
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.map);

      this.refreshMarkers();
    });
  }

  private refreshMarkers(): void {
    if (!this.map) return;
    this.zone.runOutsideAngular(() => {
      this.markers.forEach((m) => m.remove());
      this.markers = [];

      const withCoords = this.places.filter((p) => p.lat != null && p.lon != null);
      this.zone.run(() => (this.noCoords = withCoords.length === 0));

      if (withCoords.length === 0) return;

      const bounds: L.LatLngTuple[] = [];

      withCoords.forEach((place) => {
        const color = dayColor(place.dayNumber);
        const label = place.dayNumber ? String(place.dayNumber) : '•';
        const icon = buildIcon(color, label);

        const popup = L.popup({ offset: [0, -10], maxWidth: 220 }).setContent(`
          <div style="font-family:'Inter',sans-serif;padding:4px 2px">
            <div style="font-weight:700;font-size:0.875rem;color:#111827;margin-bottom:4px">${place.name}</div>
            ${
              place.dayNumber
                ? `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:700">Dia ${place.dayNumber}${place.dayLabel ? ' · ' + place.dayLabel : ''}</span>`
                : `<span style="background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">Por planear</span>`
            }
          </div>`);

        const marker = L.marker([place.lat!, place.lon!], { icon })
          .bindPopup(popup)
          .addTo(this.map!);
        this.markers.push(marker);
        bounds.push([place.lat!, place.lon!]);
      });

      if (bounds.length === 1) {
        this.map!.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        this.map!.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    });
  }
}
