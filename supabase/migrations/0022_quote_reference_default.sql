alter table commerce.quote_requests
  alter column public_reference set default (
    'LM-RQ-' || upper(substr(
      replace(extensions.gen_random_uuid()::text, '-', ''),
      1,
      8
    ))
  );

