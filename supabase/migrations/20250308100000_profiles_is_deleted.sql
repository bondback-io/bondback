-- Soft delete for users (admin only). RLS should restrict updates to admins.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

COMMENT ON COLUMN profiles.is_deleted IS 'Soft delete: set to true by admin; hide from normal listings unless admin';
