begin;

-- save_testing_day returns a column named testing_day_id and also works with
-- several tables that contain a testing_day_id column. PostgreSQL otherwise
-- treats those unqualified references as ambiguous PL/pgSQL variables.
do $migration$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.save_testing_day(uuid,text,text,date,text,uuid[],uuid[],jsonb)'::regprocedure
  )
  into function_definition;

  if position('#variable_conflict use_column' in function_definition) = 0 then
    updated_definition := replace(
      function_definition,
      'AS $function$',
      E'AS $function$\n#variable_conflict use_column'
    );

    if updated_definition = function_definition then
      raise exception 'Could not locate the save_testing_day function body delimiter.';
    end if;

    execute updated_definition;
  end if;
end;
$migration$;

comment on function public.save_testing_day(uuid, text, text, date, text, uuid[], uuid[], jsonb)
  is 'Atomically creates or updates a facility Testing Day, its deduplicated participant roster, and ordered tests.';

commit;
