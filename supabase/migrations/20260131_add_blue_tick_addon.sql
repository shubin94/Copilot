-- Blue Tick add-on: separate from subscription so it survives expiry/downgrade
ALTER TABLE detectives ADD COLUMN IF NOT EXISTS blue_tick_addon boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN detectives.blue_tick_addon IS 'Blue Tick purchased as add-on; independent of subscription; never cleared by applyPackageEntitlements';
