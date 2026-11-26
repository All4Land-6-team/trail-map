INSERT INTO spot_course (facility_id, course_id, distance_meters, matching_method)
SELECT facility.facility_id,
       course.course_id,
       ST_Distance(
           facility.facility_location::geography,
           ST_StartPoint(course.course_geometry)::geography
       ),
       'SPATIAL_BUFFER'
FROM facility
JOIN course ON course.mountain_id = facility.mountain_id
WHERE facility.mountain_id IS NOT NULL
  AND ST_DWithin(
        facility.facility_location::geography,
        ST_StartPoint(course.course_geometry)::geography,
        250
      )
ON CONFLICT DO NOTHING;

INSERT INTO spot_course (user_spot_id, course_id, distance_meters, matching_method)
SELECT spot.spot_id,
       course.course_id,
       ST_Distance(
           spot.spot_location::geography,
           ST_StartPoint(course.course_geometry)::geography
       ),
       'SPATIAL_BUFFER'
FROM user_spot spot
JOIN course ON course.mountain_id = spot.mountain_id
WHERE spot.mountain_id IS NOT NULL
  AND ST_DWithin(
        spot.spot_location::geography,
        ST_StartPoint(course.course_geometry)::geography,
        250
      )
ON CONFLICT DO NOTHING;
