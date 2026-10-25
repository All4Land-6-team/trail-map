import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttributionControl, LngLatBounds, Marker, type MapLibreMap } from 'maplibre-gl';
import BaseMap from '../../components/map/BaseMap';
import { groupFacilityLocations } from '../../api/facilities';
import type { Facility } from '../../types/facility';

const CENTER: [number, number] = [126.99, 37.69];

type Props = {
  facilities: readonly Facility[];
  selected: Facility | null;
  fitRequest: number;
  onSelect: (id: number) => void;
};

export function FacilityPreviewMap({ facilities, selected, fitRequest, onSelect }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const ready = useCallback((instance: MapLibreMap | null) => setMap(instance), []);
  const groups = useMemo(() => groupFacilityLocations(facilities), [facilities]);
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const markersRef = useRef<{ button: HTMLButtonElement; group: Facility[] }[]>([]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    if (!map) return;
    const attribution = new AttributionControl({ compact: true });
    map.addControl(attribution, 'bottom-right');
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); if (map.hasControl(attribution)) map.removeControl(attribution); };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const created = groups.map(group => {
      const first = group[0];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'facility-preview__marker';
      button.textContent = group.length > 1 ? String(group.length) : 'WC';
      button.title = group.map(facility => `${facility.name ?? '이름 없음'} · OBJECTID ${facility.sourceRecordId ?? '없음'}`).join('\n');
      button.setAttribute('aria-label', group.length > 1
        ? `같은 위치의 화장실 ${group.length}건, 클릭할 때마다 다음 시설 선택`
        : `${first.name ?? '화장실'} · OBJECTID ${first.sourceRecordId ?? '없음'}`);
      button.addEventListener('click', () => {
        const index = group.findIndex(facility => facility.facilityId === selectedRef.current?.facilityId);
        selectRef.current(group[(index + 1) % group.length].facilityId);
      });
      const marker = new Marker({ element: button, anchor: 'center' })
        .setLngLat([first.longitude, first.latitude]).addTo(map);
      return { button, group, marker };
    });
    markersRef.current = created;
    return () => { created.forEach(({ marker }) => marker.remove()); markersRef.current = []; };
  }, [map, groups]);

  useEffect(() => {
    if (!map || facilities.length === 0) return;
    const bounds = new LngLatBounds();
    facilities.forEach(facility => bounds.extend([facility.longitude, facility.latitude]));
    map.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 0 });
  }, [map, facilities, fitRequest]);

  useEffect(() => {
    for (const { button, group } of markersRef.current) {
      const active = group.some(facility => facility.facilityId === selected?.facilityId);
      button.setAttribute('aria-pressed', String(active));
    }
    if (map && selected) map.easeTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(map.getZoom(), 14), duration: 350 });
  }, [map, groups, selected]);

  return <section className="facility-preview__map" aria-label="화장실 위치 지도">
    <BaseMap className="facility-preview__base" center={CENTER} zoom={11} onMapReady={ready} />
    <div className="facility-preview__map-key"><span aria-hidden="true">WC</span> 화장실
      <small>숫자는 같은 좌표의 시설 수입니다.</small>
    </div>
  </section>;
}
