BEGIN;

INSERT INTO branch_mappings (source_code, branch_code, label, active)
VALUES
  ('D1180', '001', 'Legacy GAS branch mapping for D1180', true),
  ('D6239', '003', 'Legacy GAS branch mapping for D6239', true),
  ('D5811', '004', 'Legacy GAS branch mapping for D5811', true)
ON CONFLICT (source_code) DO UPDATE SET
  branch_code = EXCLUDED.branch_code,
  label = EXCLUDED.label,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO app_settings (setting_key, setting_value, description, is_secret)
VALUES
  ('app.name', 'Seamless X GAS Excel Formatter', 'Legacy GAS SXConfig.APP_NAME.', false),
  ('app.key', 'sx-gas-excel-format-v2', 'Legacy GAS SXConfig.APP_KEY.', false),
  ('upload.max_bytes', '20971520', 'Legacy GAS max upload size: 20 * 1024 * 1024.', false),
  ('upload.max_batch_files', '20', 'Legacy GAS maximum files per browser batch.', false),
  ('output.retention_hours', '12', 'Legacy GAS workspace stale-file retention window.', false),
  ('legacy.workspace_folder_name', 'SeamlessXGASExcelFormatV2 Workspace', 'Legacy GAS Drive workspace folder name.', false),
  ('legacy.workspace_folder_property_key', 'SX_WORKSPACE_FOLDER_ID', 'Legacy GAS User Properties key for workspace folder id.', false),
  ('legacy.processing_registry_spreadsheet_property_key', 'SX_PROCESSING_REGISTRY_SPREADSHEET_ID', 'Legacy GAS Script Properties key for registry spreadsheet id.', false),
  ('legacy.processing_registry_title', 'SeamlessXGASExcelFormatV2 Processing Registry', 'Legacy GAS registry spreadsheet title.', false),
  ('legacy.processing_registry_sheet_name', 'ProcessingRegistry', 'Legacy GAS registry sheet name.', false),
  ('legacy.preview_archive_folder_id', '1UtikzyKi8Kg65W6zPz0WYOJ98Xmj7wWx', 'Legacy GAS preview archive Drive folder id; not a secret.', false),
  ('preview.spreadsheet_locale', 'th_TH', 'Legacy GAS preview spreadsheet locale.', false),
  ('preview.spreadsheet_time_zone', 'Asia/Bangkok', 'Legacy GAS preview spreadsheet timezone.', false),
  ('format.target_font_name', 'AngsanaUPC', 'Legacy GAS target workbook font family.', false),
  ('format.target_font_size', '9', 'Legacy GAS target workbook font size.', false),
  ('format.highlight_background', '#ffc7ce', 'Legacy GAS exact-150 highlight background.', false),
  ('format.highlight_font_color', '#9c0006', 'Legacy GAS exact-150 highlight font color.', false)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  is_secret = EXCLUDED.is_secret,
  updated_at = now();

COMMIT;
