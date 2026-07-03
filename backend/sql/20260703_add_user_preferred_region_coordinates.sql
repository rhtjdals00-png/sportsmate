-- Add a second preferred region and coordinates for profile location recommendations.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS region_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS region_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS region_2 VARCHAR(120),
  ADD COLUMN IF NOT EXISTS region_2_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS region_2_longitude DOUBLE PRECISION;
