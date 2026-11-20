UPDATE review_environment
SET weather_status = 'FAILED',
    weather_code = NULL
WHERE weather_code = 'FOG';
