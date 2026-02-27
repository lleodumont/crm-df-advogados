/*
  # Fix current_user_role function

  1. Changes
    - Update current_user_role() function to use correct column name 'id' instead of 'user_id'
    - This fixes the RLS policies that depend on this function
  
  2. Impact
    - Users will now be able to see leads and other data according to their role
    - Dashboard and LeadsList will work correctly
*/

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  select coalesce((select role from public.user_profiles where id = auth.uid()), 'viewer');
$function$;
