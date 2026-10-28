import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AttributionControl, LngLatBounds, Marker, type MapLibreMap } from 'maplibre-gl';
import BaseMap from '../../components/map/BaseMap';
import { SpotMarker } from '../../components/map';
import { Icon } from '../../components/common/Icon';
import { groupFacilityLocations } from '../../api/facilities';
import type { CourseFacilityType, Facility } from '../../types/facility';
import { facilitySpotKind } from '../../utils/courseFacilities';

const CENTER: [number, number] = [126.99, 37.69];

type Props = {
  type: CourseFacilityType;
  label: string;
  facilities: readonly Facility[];
  selected: Facility | null;
  fitRequest: number;
  onSelect: (id: number) => void;
};

export function FacilityPreviewMap({ type, label, facilities, selected, fitRequest, onSelect }: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const ready = useCallback((instance: MapLibreMap | null) => setMap(instance), []);
  const kind = facilitySpotKind(type);
  // MapLibre Marker에 넘길 DOM 노드. SpotMarker는 포털로 이 안에 그린다.
  const markers = useMemo(() => groupFacilityLocations(facilities)
    .map(group => ({ group, node: document.createElement('div') })), [facilities]);

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
    const created = markers.map(({ group, node }) => new Marker({ element: node, anchor: 'center' })
      .setLngLat([group[0].longitude, group[0].latitude]).addTo(map));
    return () => created.forEach(marker => marker.remove());
  }, [map, markers]);

  useEffect(() => {
    if (!map || facilities.length === 0) return;
    const bounds = new LngLatBounds();
    facilities.forEach(facility => bounds.extend([facility.longitude, facility.latitude]));
    map.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 0 });
  }, [map, facilities, fitRequest]);

  useEffect(() => {
    if (map && selected) map.easeTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(map.getZoom(), 14), duration: 350 });
  }, [map, selected]);

  return <section className="facility-preview__map" aria-label="시설 위치 지도">
    <BaseMap className="facility-preview__base" center={CENTER} zoom={11} onMapReady={ready} />
    {markers.map(({ group, node }) => {
      const first = group[0];
      const active = group.some(facility => facility.facilityId === selected?.facilityId);
      // 같은 좌표의 시설은 마커를 누를 때마다 다음 시설을 선택한다.
      const selectNext = () => {
        const index = group.findIndex(facility => facility.facilityId === selected?.facilityId);
        onSelect(group[(index + 1) % group.length].facilityId);
      };
      return createPortal(<>
        <SpotMarker kind={kind} aria-pressed={active} onClick={selectNext}
          title={group.map(facility => `${facility.name ?? '이름 없음'} · 원본 식별자 ${facility.sourceRecordId ?? '없음'}`).join('\n')}
          aria-label={group.length > 1
            ? `같은 위치의 ${label} ${group.length}건, 클릭할 때마다 다음 시설 선택`
            : `${first.name ?? label} · 원본 식별자 ${first.sourceRecordId ?? '없음'}`} />
        {group.length > 1 && <span className="facility-preview__marker-count" aria-hidden="true">{group.length}</span>}
      </>, node, first.facilityId);
    })}
    <div className="facility-preview__map-key"><Icon name={kind === 'water' ? 'Water' : kind === 'shelter' ? 'Shelter' : 'Restroom'} size={16} /> {label}
      <small>숫자는 같은 좌표의 시설 수입니다.</small>
    </div>
  </section>;
}
