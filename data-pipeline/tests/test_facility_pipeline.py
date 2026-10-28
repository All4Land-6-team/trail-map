import copy
import csv
import json
import sys

import pytest

from trail_map_data.facilities import mountain_membership, pipeline
from test_facilities import make_source
from test_mountain_membership import database  # 동일한 세션 임시 PostGIS 테이블 fixture


@pytest.fixture
def inputs(tmp_path):
    restrooms = make_source(tmp_path, [(1, 1501, 127.00, 37.70)])
    springs = tmp_path / "springs.csv"
    structures = tmp_path / "structures.csv"
    for path, rows in [
        (springs, [["국립공원", "지점명", "지점주소", "경도", "위도"],
                   ["북한산", "시험 샘터", "입구", 127.02, 37.70]]),
        (structures, [["시설물명칭", "상대위치", "X좌표", "Y좌표"],
                      ["시험 음수대", "입구", 127.01, 37.70],
                      ["시험 쉼터", "능선", 127.03, 37.70],
                      ["쉼터", "좌표 없음", "", ""]]),
    ]:
        with path.open("w", encoding="cp949", newline="") as stream:
            csv.writer(stream).writerows(rows)
    return {"restrooms": restrooms, "springs": springs, "structures": structures}


def test_common_candidates_preserve_source_fields_and_merge_only_same_source(inputs):
    from trail_map_data.facilities import knps_drinking_water, knps_restrooms, knps_shelters
    result = pipeline.build_candidates(**inputs)
    originals = [knps_restrooms.preprocess(inputs["restrooms"], park_code="1501"),
                 knps_drinking_water.preprocess(inputs["springs"], kind="springs")]
    assert result[:2] == originals
    water = knps_drinking_water.preprocess(inputs["structures"], kind="structures")
    shelter = knps_shelters.preprocess(inputs["structures"])
    combined = result[2]
    assert combined["source"] == water["source"] == shelter["source"]
    assert combined["facilities"] == sorted(water["facilities"] + shelter["facilities"], key=lambda r: r["sourceRecordId"])
    assert combined["report"]["byType"] == {"DRINKING_WATER": water["report"], "SHELTER": shelter["report"]}
    with pytest.raises(ValueError, match="different_sources"):
        pipeline.merge_source_documents(water, result[1])
    collision = copy.deepcopy(shelter)
    collision["facilities"][0]["sourceRecordId"] = water["facilities"][0]["sourceRecordId"]
    with pytest.raises(ValueError, match="conflicting_duplicate"):
        pipeline.merge_source_documents(water, collision)


def test_full_pipeline_outputs_v2_and_reclassification_keeps_outside_candidates(inputs, tmp_path, database, monkeypatch):
    monkeypatch.setattr(mountain_membership, "preprocess_many",
                        lambda documents, **kw: mountain_membership.classify_documents(documents, database, **kw))
    output = tmp_path / "output"
    initial = pipeline.run(**inputs, output_dir=output)
    assert initial["byType"] == {"RESTROOM": 1, "DRINKING_WATER": 2, "SHELTER": 1}
    assert initial["total"] == 4
    original = [json.loads((output / name).read_text(encoding="utf-8")) for name in pipeline.OUTPUT_NAMES]
    assert all(d["schemaVersion"] == 2 for d in original)
    assert all(r["mountainId"] == 2 for d in original for r in d["facilities"])
    assert pipeline.run(**inputs, output_dir=output, overwrite=True) == initial
    database.execute("""UPDATE pg_temp.mountain SET mountain_boundary =
        ST_Multi(ST_MakeEnvelope(127,37.69,127.02,37.71,4326))""")
    updated = pipeline.run(**inputs, output_dir=output, overwrite=True)
    assert updated["total"] == 4
    counts = [d["report"]["mountainMembership"]["counts"] for d in updated["sources"]]
    assert sum(c["inside"] for c in counts) == 1
    assert sum(c["onBoundary"] for c in counts) == 2
    assert sum(c["outside"] for c in counts) == 1
    for name, before in zip(pipeline.OUTPUT_NAMES, original):
        after = json.loads((output / name).read_text(encoding="utf-8"))
        assert after["source"] == before["source"]
        for a, b in zip(after["facilities"], before["facilities"]):
            assert {k: v for k, v in a.items() if k != "mountainId"} == {k: v for k, v in b.items() if k != "mountainId"}
    assert after["facilities"][0]["type"] in {"SHELTER", "DRINKING_WATER"}
    assert next(r for r in after["facilities"] if r["type"] == "SHELTER")["mountainId"] is None


def test_failed_classification_or_existing_output_never_replaces_files(inputs, tmp_path, monkeypatch):
    output = tmp_path / "output"
    def fail(*args, **kwargs):
        raise ValueError("mountain_database_error")
    monkeypatch.setattr(mountain_membership, "preprocess_many", fail)
    with pytest.raises(ValueError, match="mountain_database_error"):
        pipeline.run(**inputs, output_dir=output)
    assert not output.exists()
    output.mkdir()
    existing = output / "structures.json"
    existing.write_text("previous output", encoding="utf-8")
    with pytest.raises(FileExistsError):
        pipeline.run(**inputs, output_dir=output)
    with pytest.raises(ValueError, match="mountain_database_error"):
        pipeline.run(**inputs, output_dir=output, overwrite=True)
    assert existing.read_text(encoding="utf-8") == "previous output"
    assert sorted(p.name for p in output.iterdir()) == ["structures.json"]


def test_cli_runs_all_adapters_and_emits_summary(inputs, tmp_path, monkeypatch, capsys):
    def classified(documents, **kwargs):
        return [d | {"schemaVersion": 2, "facilities": [r | {"mountainId": 2} for r in d["facilities"]]} for d in documents]
    monkeypatch.setattr(mountain_membership, "preprocess_many", classified)
    args = ["pipeline", "--output-dir", str(tmp_path / "output")]
    for key, path in inputs.items():
        args.extend([f"--{key}", str(path)])
    monkeypatch.setattr(sys, "argv", args)
    pipeline.main()
    assert json.loads(capsys.readouterr().out)["total"] == 4
    with pytest.raises(SystemExit) as failure:
        pipeline.main()
    assert failure.value.code == 1
