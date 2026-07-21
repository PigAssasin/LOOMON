create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists catalog;
create schema if not exists commerce;
create schema if not exists agent;
create schema if not exists wallet;
create schema if not exists payments;
create schema if not exists search;
create schema if not exists notifications;
create schema if not exists internal;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'vi' check (preferred_locale in ('vi', 'en')),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table catalog.makers (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug = lower(slug)),
  legal_name text,
  display_name text not null,
  story text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'suspended')),
  country_code text not null default 'VN' check (char_length(country_code) = 2),
  province_code text,
  default_moq integer not null default 1 check (default_moq > 0),
  default_lead_time_min_days integer not null default 7 check (default_lead_time_min_days > 0),
  default_lead_time_max_days integer not null default 30 check (default_lead_time_max_days >= default_lead_time_min_days),
  default_currency text not null default 'USDC' check (default_currency in ('USDC', 'VND')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table catalog.maker_memberships (
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'catalog_editor', 'order_manager', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (maker_id, user_id)
);
create index maker_memberships_user_id_idx on catalog.maker_memberships(user_id, status);

create table catalog.products (
  id bigint generated always as identity primary key,
  maker_id bigint not null references catalog.makers(id) on delete restrict,
  slug text not null unique check (slug = lower(slug)),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'rejected', 'archived')),
  published_version_id bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_maker_id_idx on catalog.products(maker_id);
create index products_publication_idx on catalog.products(status, id) where status = 'published';

create table catalog.product_versions (
  id bigint generated always as identity primary key,
  product_id bigint not null references catalog.products(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  workflow_status text not null default 'draft' check (workflow_status in ('draft', 'validation_failed', 'ready_for_review', 'approved', 'published', 'superseded', 'rejected')),
  production_model text not null default 'made_to_order' check (production_model in ('ready_stock', 'made_to_order', 'mixed')),
  customizable boolean not null default false,
  minimum_order_quantity integer not null check (minimum_order_quantity > 0),
  lead_time_min_days integer not null check (lead_time_min_days > 0),
  lead_time_max_days integer not null check (lead_time_max_days >= lead_time_min_days),
  country_of_origin text not null default 'VN',
  province_of_origin text,
  data_quality_score numeric(5,2) not null default 0 check (data_quality_score between 0 and 100),
  schema_version integer not null default 1,
  based_on_version_id bigint references catalog.product_versions(id),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, version_number)
);
create index product_versions_product_id_idx on catalog.product_versions(product_id, version_number desc);
alter table catalog.products add constraint products_published_version_id_fkey foreign key (published_version_id) references catalog.product_versions(id) on delete set null;

create table catalog.product_localizations (
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  locale text not null check (locale in ('vi', 'en')),
  title text not null check (char_length(trim(title)) >= 3),
  short_description text,
  story text not null check (char_length(trim(story)) >= 40),
  care_instructions text,
  production_notes text,
  seo_title text,
  seo_description text,
  primary key (product_version_id, locale)
);

create table catalog.product_variants (
  id bigint generated always as identity primary key,
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  sku text,
  variant_code text not null,
  display_order integer not null default 0,
  pack_quantity integer not null default 1 check (pack_quantity > 0),
  weight_grams integer check (weight_grams > 0),
  length_mm integer check (length_mm > 0),
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  volume_ml integer check (volume_ml > 0),
  moq_override integer check (moq_override > 0),
  lead_time_min_days_override integer check (lead_time_min_days_override > 0),
  lead_time_max_days_override integer check (lead_time_max_days_override >= lead_time_min_days_override),
  active boolean not null default true,
  unique (product_version_id, variant_code)
);
create index product_variants_version_id_idx on catalog.product_variants(product_version_id, active);

create table catalog.price_rules (
  id bigint generated always as identity primary key,
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  variant_id bigint references catalog.product_variants(id) on delete cascade,
  currency_code text not null check (currency_code in ('USDC', 'VND')),
  price_type text not null check (price_type in ('fixed', 'starting_from', 'tiered', 'quote_only')),
  unit_amount numeric(20,6) check (unit_amount >= 0),
  minimum_quantity integer not null default 1 check (minimum_quantity > 0),
  maximum_quantity integer check (maximum_quantity >= minimum_quantity),
  valid_from timestamptz not null default now(),
  valid_until timestamptz check (valid_until > valid_from),
  source text not null default 'seller_entered' check (source in ('seller_entered', 'reviewer_adjusted', 'imported'))
);
create index price_rules_version_lookup_idx on catalog.price_rules(product_version_id, currency_code, minimum_quantity);

create table catalog.vocabularies (
  id bigint generated always as identity primary key,
  code text not null unique check (code = lower(code)),
  description text
);

create table catalog.terms (
  id bigint generated always as identity primary key,
  vocabulary_id bigint not null references catalog.vocabularies(id) on delete restrict,
  code text not null check (code = lower(code)),
  parent_id bigint references catalog.terms(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'deprecated', 'pending')),
  sort_order integer not null default 0,
  unique(vocabulary_id, code)
);
create index terms_vocabulary_id_idx on catalog.terms(vocabulary_id, status);

create table catalog.term_localizations (
  term_id bigint not null references catalog.terms(id) on delete cascade,
  locale text not null check (locale in ('vi', 'en')),
  label text not null,
  description text,
  primary key(term_id, locale)
);

create table catalog.term_synonyms (
  id bigint generated always as identity primary key,
  term_id bigint not null references catalog.terms(id) on delete cascade,
  locale text not null check (locale in ('vi', 'en')),
  synonym text not null,
  normalized_synonym text not null,
  source text not null default 'curated' check (source in ('curated', 'seller', 'search_eval')),
  unique(term_id, locale, normalized_synonym)
);
create index term_synonyms_normalized_idx on catalog.term_synonyms using gin(normalized_synonym extensions.gin_trgm_ops);

create table catalog.product_terms (
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  term_id bigint not null references catalog.terms(id) on delete restrict,
  source text not null check (source in ('seller', 'reviewer', 'ai_suggested', 'imported')),
  confidence numeric(4,3) check (confidence between 0 and 1),
  confirmed_by uuid references auth.users(id),
  primary key(product_version_id, term_id)
);
create index product_terms_term_id_idx on catalog.product_terms(term_id, product_version_id);

create table catalog.customization_definitions (
  id bigint generated always as identity primary key,
  code text not null unique,
  input_type text not null check (input_type in ('boolean', 'select', 'multiselect', 'text', 'number', 'asset_upload')),
  value_type text not null,
  unit text,
  constraints jsonb not null default '{}'::jsonb,
  affects_price boolean not null default false,
  affects_lead_time boolean not null default false,
  schema_version integer not null default 1
);

create table catalog.product_customizations (
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  customization_definition_id bigint not null references catalog.customization_definitions(id) on delete restrict,
  required_for_quote boolean not null default false,
  seller_instructions text,
  price_adjustment_type text check (price_adjustment_type in ('none', 'fixed', 'per_unit', 'quote_only')),
  price_adjustment_value numeric(20,6) check (price_adjustment_value >= 0),
  lead_time_delta_days integer check (lead_time_delta_days >= 0),
  primary key(product_version_id, customization_definition_id)
);

create table catalog.media_assets (
  id bigint generated always as identity primary key,
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'video', 'document')),
  mime_type text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  bytes bigint not null check (bytes > 0),
  checksum text not null,
  rights_status text not null default 'pending' check (rights_status in ('pending', 'confirmed', 'rejected')),
  source text not null check (source in ('seller_upload', 'platform', 'imported', 'generated')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(storage_bucket, storage_path)
);
create index media_assets_maker_id_idx on catalog.media_assets(maker_id, created_at desc);

create table catalog.product_media (
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  media_asset_id bigint not null references catalog.media_assets(id) on delete restrict,
  role text not null check (role in ('cover', 'gallery', 'detail', 'scale_reference', 'packaging', 'maker_story')),
  display_order integer not null default 0,
  focal_x numeric(5,4) check (focal_x between 0 and 1),
  focal_y numeric(5,4) check (focal_y between 0 and 1),
  alt_text_vi text,
  alt_text_en text,
  primary key(product_version_id, media_asset_id)
);

create table catalog.import_jobs (
  id bigint generated always as identity primary key,
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  format text not null check (format in ('csv', 'xlsx', 'json')),
  source_file_path text not null,
  template_version integer not null default 1,
  status text not null default 'uploaded' check (status in ('uploaded', 'parsing', 'validation_failed', 'ready', 'importing', 'completed', 'failed')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index import_jobs_maker_id_idx on catalog.import_jobs(maker_id, created_at desc);

create table catalog.import_rows (
  id bigint generated always as identity primary key,
  import_job_id bigint not null references catalog.import_jobs(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_payload jsonb not null,
  normalized_payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'valid', 'invalid', 'imported')),
  product_id bigint references catalog.products(id),
  product_version_id bigint references catalog.product_versions(id),
  unique(import_job_id, row_number)
);
create index import_rows_job_status_idx on catalog.import_rows(import_job_id, status);

create table catalog.validation_issues (
  id bigint generated always as identity primary key,
  maker_id bigint not null references catalog.makers(id) on delete cascade,
  subject_type text not null check (subject_type in ('product_version', 'import_row', 'media_asset')),
  subject_id bigint not null,
  field_path text not null,
  severity text not null check (severity in ('info', 'warning', 'error')),
  code text not null,
  message_vi text not null,
  message_en text,
  suggested_value jsonb,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'accepted', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index validation_issues_subject_idx on catalog.validation_issues(subject_type, subject_id, resolution_status);

create table catalog.field_provenance (
  id bigint generated always as identity primary key,
  product_version_id bigint not null references catalog.product_versions(id) on delete cascade,
  field_path text not null,
  source_type text not null check (source_type in ('seller', 'reviewer', 'ai', 'import')),
  source_reference text,
  model text,
  prompt_version text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index field_provenance_version_idx on catalog.field_provenance(product_version_id, field_path);
