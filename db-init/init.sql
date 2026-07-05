-- Enable the PostGIS extension for spatial computations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure the extension is active
SELECT postgis_full_version();
