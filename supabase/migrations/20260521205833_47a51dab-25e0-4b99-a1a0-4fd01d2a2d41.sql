UPDATE public.affiliates
SET fixed_remuneration_installments = (fixed_remuneration_installments #>> '{}')::jsonb
WHERE jsonb_typeof(fixed_remuneration_installments) = 'string';