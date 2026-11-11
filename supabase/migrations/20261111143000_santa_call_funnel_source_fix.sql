-- Correct the generic portrait recovery route previously stored for Santa calls.
-- Existing rows have no trustworthy visitor session/UTM data, so none is invented.
update public.christmas_orders
set source_route = '/christmas/santa-call',
    landing_path = coalesce(landing_path, '/christmas/santa-call'),
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{source_route}',
      '"/christmas/santa-call"'::jsonb,
      true
    ),
    updated_at = now()
where product_key in (
  'christmas_santa_voice_call',
  'christmas_santa_voice_call_extension'
)
and (
  source_route is distinct from '/christmas/santa-call'
  or landing_path is null
  or metadata->>'source_route' is distinct from '/christmas/santa-call'
);
