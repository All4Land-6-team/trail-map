import importlib.util
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'data-pipeline/src'))
from trail_map_data.course_analysis import AnalysisConfig, analyze_course_to_file

spec = importlib.util.spec_from_file_location('prepare_steep_analysis', REPO / 'data-pipeline/scripts/prepare-steep-course-analysis.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.fixture
def scenario(tmp_path):
    dem = tmp_path / 'data/processed/dem/bukhansan/analysis/bukhansan_dem.tif'
    dem.parent.mkdir(parents=True)
    with rasterio.open(dem, 'w', driver='GTiff', width=64, height=64, count=1,
                       dtype='float64', crs='EPSG:3857', transform=from_origin(0, 640, 10, 10)) as dataset:
        dataset.write(np.arange(4096, dtype='float64').reshape(64,64), 1)
    folder = tmp_path / 'data/processed/course-analysis/original'
    folder.mkdir(parents=True)
    xs, ys = transform('EPSG:3857', 'EPSG:4326', [50, 75, 100], [400, 420, 440])
    coordinates = [list(pair) for pair in zip(xs, ys)]
    responses = {}
    for course_id in range(1,14):
        feature = {'type':'Feature', 'properties':{'course_id':course_id, 'mountain_id':1,
                    'course_version':1, 'course_name':f'코스{course_id}', 'source_kind':'official', 'source_id':20},
                   'geometry':{'type':'LineString','coordinates':coordinates}}
        route_path = folder / f'course-{course_id}.geojson'
        module.write_json(route_path, feature)
        doc = analyze_course_to_file(dem, route_path, folder / f'unused-{course_id}.json',
                                     config=AnalysisConfig(sample_interval_meters=10, elevation_unit='m'))
        doc['schema_version'] = 1
        doc['algorithm_version'] = 'course-dem-v1'
        for key in ('steep_slope_threshold_percent','steep_slope_method'):
            doc['settings'].pop(key)
        for key in ('slope_analyzed_distance_meters','steep_distance_meters','steep_section_ratio_percent'):
            doc['summary'].pop(key)
        module.write_json(folder / f'course-{course_id}.json', doc)
        summary = doc['summary']
        analysis = {'courseId':course_id, 'mountainId':1, 'currentCourseVersion':1,
                    'analyzedCourseVersion':1, 'sourceKind':'official', 'analysisId':course_id,
                    'algorithmVersion':doc['algorithm_version'], 'sourceType':doc['source_type'],
                    'qualityStatus':doc['quality_status'], 'calculatedAt':doc['calculated_at'],
                    'qualityReasons':doc['quality_reasons'],
                    'settings':{remote:doc['settings'][local] for local,remote in module.SETTINGS_FIELDS.items()},
                    'metrics':{remote:summary[local] for local,remote in module.SUMMARY_FIELDS.items()},
                    'coverage':{remote:summary[local] for local,remote in module.COVERAGE_FIELDS.items()},
                    'profileUrl':f'/api/v1/course-analyses/{course_id}/profile'}
        analysis['metrics'].update(estimatedDurationSeconds=None, steepSectionRatioPercent=None)
        samples = [{**{remote:p[local] for local,remote in module.SAMPLE_FIELDS.items()},
                    'coordinate':[p['longitude'],p['latitude']]} for p in doc['profile']]
        responses[f'/api/v1/courses/{course_id}/analysis'] = analysis
        responses[analysis['profileUrl']] = {'analysis':analysis, 'samples':samples}
        responses[f'/api/v1/courses/{course_id}/route'] = {'courseId':course_id, 'courseVersion':1,
            'mountainId':1, 'courseName':f'코스{course_id}', 'geometry':doc['course']['geometry'],
            'source':{'validationStatus':'candidate_smap_unverified'}}
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            payload = json.dumps({'data':responses[self.path]}, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        def do_POST(self):
            raise AssertionError('DB write attempted')
        def log_message(self, *args):
            pass
    server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield tmp_path, folder, f'http://127.0.0.1:{server.server_port}', responses
    server.shutdown()
    server.server_close()
    thread.join()


def test_thirteen_courses_recomputed_with_same_values_and_no_old_file_changes(scenario):
    root, folder, api, _ = scenario
    old_hashes = {p:module.sha256(p) for p in folder.glob('*')}
    output = folder.parent/'new-confirmed-m'
    module.prepare(root, output, api)
    report = module.read_json(output/'summary.json')
    assert report['readyForImport'] is True
    assert report['writesDatabase'] is False
    assert len(report['courses']) == 13
    for row in report['courses']:
        document = module.read_json(Path(row['file']))
        assert row['unitSource'] == 'caller_declaration'
        assert document['schema_version'] == 2
        assert document['settings']['steep_slope_threshold_percent'] == 20
        assert document['summary']['steep_section_ratio_percent'] == row['steepRatioPercent']
        assert document['quality_reasons'] == ['UNVERIFIED_VERTICAL_REFERENCE']
        assert document['quality_status'] == 'PARTIAL'
        assert document['course']['source_id'] == 20
        assert row['sha256'] == module.sha256(Path(row['file']))
    assert all(module.sha256(p)==digest for p,digest in old_hashes.items())
    with pytest.raises(ValueError,match='이미'):
        module.prepare(root, output, api)


def test_missing_current_source_document_prevents_ready_output(scenario):
    root, folder, api, _ = scenario
    (folder/'course-8.json').unlink()
    output = folder.parent/'missing'
    with pytest.raises(ValueError,match=r'\[8\]'):
        module.prepare(root,output,api)
    assert not output.exists()


def test_existing_row_only_metrics_stop_before_generation(scenario):
    root, folder, api, responses = scenario
    responses['/api/v1/courses/1/analysis']['metrics']['estimatedDurationSeconds'] = 3600
    output = folder.parent/'row-metric'
    with pytest.raises(ValueError,match='별도 예상 시간'):
        module.prepare(root,output,api)
    assert not output.exists()


def test_numeric_change_prevents_import_readiness(scenario):
    root, folder, api, responses = scenario
    path = folder/'course-1.json'
    document = module.read_json(path)
    document['profile'][1]['slope_percent'] += 1
    responses['/api/v1/course-analyses/1/profile']['samples'][1]['slopePercent'] += 1
    path.write_text(json.dumps(document),encoding='utf-8')
    output = folder.parent/'changed-number'
    with pytest.raises(ValueError,match='계산값'):
        module.prepare(root,output,api)
    assert not (output/'summary.json').exists()


def test_dem_fingerprint_change_stops_before_generation(scenario):
    root, folder, api, _ = scenario
    path = root/'data/processed/dem/bukhansan/analysis/bukhansan_dem.tif'
    with rasterio.open(path,'r+') as raster:
        raster.update_tags(UNIT_CONFIRMATION_TEST='changed')
    output = folder.parent/'changed-dem'
    with pytest.raises(ValueError,match='DEM과 일치'):
        module.prepare(root,output,api)
    assert not output.exists()


def test_unconfirmed_unit_stops(scenario):
    root, folder, api, responses = scenario
    responses['/api/v1/courses/1/analysis']['settings']['elevationUnitSource']='assumed'
    with pytest.raises(ValueError,match='확인된 m 단위'):
        module.prepare(root,folder.parent/'already-confirmed',api)
