# Fase 17A — target de producción (candidato local)

Este candidato no publica nada y no cambia GitHub, Cloudflare, Supabase ni DNS. La ruta de staging sigue separada y fijada al proyecto aislado.

## Fail-closed del frontend

- `VITE_APP_TARGET=production` solo acepta el proyecto aprobado `rfxyisqvrukslnlgzzek` mediante `src/lib/supabaseTarget.mjs`.
- La URL y la clave publicable deben llegar explícitamente al build. Si faltan, tienen formato de marcador, son una clave `sb_secret_` o un JWT `service_role`, la validación falla.
- El helper compartido lo ejecutan tanto `vite.config.ts` como el cliente del navegador. La misma regresión local cubre ambos usos.
- Staging continúa fijado a `qgppeyplrrgiedsvsvst`; `local` rechaza ambos proyectos alojados.
- No se incorpora una URL o clave productiva a `.env.example`. La referencia del proyecto es una allowlist pública, no una credencial.

## Workflow candidato

`.github/workflows/deploy-production.yml` solo acepta ejecución manual (`workflow_dispatch`) desde `main`. Primero ejecuta instalación congelada, TypeScript y regresiones. El job posterior requiere el entorno GitHub `production`; allí hace el build con target `production` y despliega mediante Wrangler a un proyecto Cloudflare separado, `s-trainerapp-production`, rama `main`.

El build valida el host Supabase exacto antes de generar `dist`; el proyecto Cloudflare destino está fijado aparte del proyecto de staging. Nunca usa `service_role` en el frontend.

## Requisitos operativos antes de habilitar el workflow

1. En GitHub, crear/configurar el Environment `production`, restringir despliegues a `main` y exigir aprobación de revisor(es). Si es posible, impedir autoaprobación. La mera referencia `environment: production` en YAML **no** crea por sí sola la aprobación obligatoria.
2. Configurar en ese Environment las variables `PRODUCTION_SUPABASE_URL`, `PRODUCTION_SUPABASE_PUBLISHABLE_KEY` y `CLOUDFLARE_ACCOUNT_ID`; guardar `CLOUDFLARE_API_TOKEN` como secreto, con permisos mínimos de Pages Edit.
3. Crear y verificar el proyecto Pages separado `s-trainerapp-production` antes de ejecutar el workflow. No se crea automáticamente como parte de esta fase.
4. Revisar y aprobar de manera independiente el cambio de frontend/target, los cambios futuros de Auth/email/Edge Functions y el DNS. Ninguno de esos cambios se ha aplicado aquí.
5. Antes del cutover, verificar el control manual del Pages de staging, el candidato desplegado y el plan de rollback.

El dominio `app.strainerapp.com` no está configurado ni asociado a ningún proyecto por este candidato. Las URLs `APP_URL`/`SITE_URL`, Auth Site URL/Redirect URLs, SMTP y Edge Functions quedan fuera del workflow de frontend y requerirán su autorización operativa independiente.
