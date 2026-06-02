ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_settings jsonb NOT NULL DEFAULT '{"incoming_document": true, "trial_expiry": true, "shared_upload": true}'::jsonb;