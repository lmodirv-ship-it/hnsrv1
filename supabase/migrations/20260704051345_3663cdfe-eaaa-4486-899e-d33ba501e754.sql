
ALTER VIEW public.service_registry SET (security_invoker = true);
ALTER VIEW public.task_runs SET (security_invoker = true);
ALTER VIEW public.task_steps SET (security_invoker = true);
