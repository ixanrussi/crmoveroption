UPDATE public.client_commission_plans
SET country_ids = ARRAY[
  '1194fdd5-51ee-4f65-b0b9-e8b818424b9b'::uuid,  -- Colombia
  '83d1f48d-f9a8-438b-a874-a89d81742d5d'::uuid,  -- Chile
  '6fc67f8a-a038-41f1-812f-7be65f382ff6'::uuid,  -- México
  '6e237fe5-48bb-441d-bc77-23c9ca982691'::uuid   -- Argentina
],
country_id = '1194fdd5-51ee-4f65-b0b9-e8b818424b9b'::uuid
WHERE id = 'f369486b-a20c-4cfa-9c95-15bb1fe0f233';