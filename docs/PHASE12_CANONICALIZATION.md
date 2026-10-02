# Fase 12 — consolidación canónica

Actualizado: 2026-10-03. Alcance: candidatos locales del paquete Fase 7 y validaciones en `qgppeyplrrgiedsvsvst`. Producción `rfxyisqvrukslnlgzzek`, GitHub remoto y AI Studio no se consultaron ni modificaron. En el aislado solo se realizaron operaciones de prueba autorizadas con identidades/datos sintéticos; no se modificaron esquema, RLS, policies ni configuración.

## Estado

| Estado | Resultado |
|---|---|
| PASS | Candidato de redirect usa `/?flow=activate`; conserva los tokens de Supabase en el fragmento. Regresión local y build Vite aprobados. La evidencia E2E de Fase 11 ya confirma que invitación, ClientActivate y ClientApp funcionan con este redirect; no se repitió esa prueba. |
| PASS | Candidato `activate-client` conserva autenticación, búsqueda por `user_id`/email, asociación con el usuario autenticado, estado `Activo`, logs diagnósticos y respuesta `{success, client}`; el `catch` ahora acepta `null`/`undefined` de forma segura. |
| PASS | Candidato ClientApp maneja una sesión sin fila `clients` con estado controlado y logout; deja accesible la pantalla de activación antes de comprobar el vínculo y recarga la ficha después de activar. |
| PASS | `ClientActivate` ahora elimina exclusivamente los pares query `flow=activate` tras completar activación; conserva otros parámetros/hash y usa `history.replaceState` sin recargar ni cerrar sesión. |
| PASS | `reset-test-users` se excluyó de todos los artefactos candidatos. La copia histórica queda fuera de este paquete canónico. |
| PASS | Migración candidata no contiene políticas `USING(true)` ni `WITH CHECK(true)` y no carga datos de producción. |
| BLOCKED | No se validó una instalación limpia: la creación de `s-trainer-phase12-clean-rebuild` en `luisroa1's Org` fue rechazada por el límite de 2 proyectos gratuitos activos. No se pausó ni eliminó ningún proyecto y no se creó el nuevo proyecto. |
| PASS | Las dos Edge Functions candidatas se transpilaron con esbuild sin errores de sintaxis. |
| PASS | Propuesta revisada contra checkout limpio en `4b2aead373adc6e2d3f620c0344e462b03e6a432`; `git apply --check` aprobado. La auditoría independiente informada por el propietario confirma que ese SHA sigue siendo HEAD remoto de `main`. |
| PASS | Build Vite y `tsc --noEmit` del candidato local: PASS. Ocho regresiones locales: PASS. |
| PASS | Orphan-guard comprobado en vivo con JWT real de una identidad sintética `client` sin fila `clients`: la UI mostró “Cuenta pendiente de vinculación”, sin pantalla blanca ni escritura automática; logout volvió a AuthScreen. El probe RLS devolvió cero filas ajenas y ownership aislado. No se relajaron policies. |
| PASS | Nueva invitación/activación sintética completada en vivo. Tras fijar contraseña, la UI llegó a ClientApp; `flow=activate` desapareció sin recarga durante el callback. Tras recargar, la sesión persistió y ClientApp volvió a mostrarse; no reapareció ClientActivate. Una consulta agregada de solo lectura en el aislado confirmó una fila activa, user_id resoluble y profile.role=client. No se leyó ni registró la contraseña o JWT. |
| BLOCKED | La migración no se ejecutó ni se validó con Supabase CLI; el CLI no está instalado y no se intentó instalarlo. Tampoco se aplicó SQL en ningún proyecto. El proyecto limpio no llegó a crearse, así que no pudieron desplegarse Edge Functions ni verificarse sus ejecuciones en Supabase/Deno. |
| PENDING PRODUCTION ACTION | Ninguna acción de esta fase requiere ejecutarse en producción. Cualquier despliegue futuro de funciones/frontend, cambio de Auth URLs o aplicación de migraciones requerirá una autorización futura independiente. |

## Redirect de activación

- Causa raíz: el antiguo `redirectTo` era `${window.location.origin}/#activate`. Supabase Auth añade al fragmento URL los tokens de callback (`access_token`, `refresh_token`, `type`). Combinar dos usos del fragmento podía producir `#activate#access_token=...`; la lectura del token y el enrutamiento se volvían ambiguos.
- Archivos del candidato: `phase12-candidates/frontend/src/components/trainer/TrainerInvite.tsx`, `phase12-candidates/frontend/src/context/AppContext.tsx` y `phase12-candidates/frontend/src/components/client/ClientApp.tsx`. La Edge Function candidata relacionada está en `phase12-candidates/supabase/functions/invite-client/index.ts`.
- El diff local contra GitHub/main capturado está en `phase12-candidates/PHASE12_CANONICAL_CANDIDATES.patch`; no se aplicó al checkout Git ni al remoto.
- Cambio candidato: la UI envía `${window.location.origin}/?flow=activate`. La función usa ese `redirectTo`; su fallback exige `APP_URL` o `SITE_URL` y construye `/?flow=activate`. No incorpora un dominio de AI Studio como fallback.
- `AppContext` extrae los tokens del fragmento, llama a `supabase.auth.setSession`, conserva `flow` en la query y limpia el fragmento con `history.replaceState`. Así Supabase puede procesar sus tokens sin competir con un marcador de ruta.
- Después de una activación exitosa, `ClientActivate` elimina solo el parámetro `flow=activate`, preservando otros parámetros y el fragmento restante. No toca la sesión ni provoca una navegación/recarga; la recarga posterior ya no encontrará ese marcador obsoleto. El refresh real posterior a activar se validó el 2026-10-03 en `127.0.0.1:3002`: antes de recargar la URL era `/`, y tras recargar permaneció `/` y el panel ClientApp volvió a cargar con sesión persistida.
- `App.tsx` mantiene la sesión y resuelve el rol; para un cliente muestra `ClientApp`. `ClientApp` detecta `flow=activate` y presenta `ClientActivate`. Después de establecer contraseña y activar, el candidato vuelve a cargar `clients` mediante `loadRealClientForUser` y llega a la pantalla principal. Si no hay fila vinculada, presenta el estado controlado descrito en `CLIENTHOME_ORPHAN_STATE.md`.
- La Fase 11 documenta el recorrido E2E PASS con `/?flow=activate`, establecimiento de sesión, ClientActivate y ClientApp. La regresión de esta fase verifica además el formato de URL y el orden del callback sin usar tokens reales.

## `activate-client`: versión candidata

Fuentes preservadas:

- GitHub/main capturado: SHA-256 `72b7cb025a2db7678fdaee3c0a785e080b8f9d446167a85738a1a46bbde5aea5`.
- Producción capturada el 2026-10-01: SHA-256 `7abd55c8953dcad4c76d37115c5057308ea05efa74c4783949d19084e35a79c7`.
- Candidato local: `phase12-candidates/supabase/functions/activate-client/index.ts`, SHA-256 registrado en `SHA256SUMS-PHASE12.txt`.

El candidato parte de GitHub/main y cambia únicamente el `catch` final: requiere `err instanceof Error && err.message`; para `null`, `undefined` u otro valor no-Error responde el mensaje interno genérico. Conserva el `console.error` diagnóstico de GitHub. La fuente productiva capturada también tenía manejo defensivo, pero su mensaje/fallback se reescribió de forma más corta y eliminaba los logs. Se conserva el comportamiento funcional probado de ambas versiones en el aislado, sin cambiar el contrato.

En ambas fuentes capturadas, el handler exige Authorization, valida al caller mediante `auth.getUser()`, busca la fila por `user_id` y como fallback por email, la asocia al UID autenticado, marca `status: 'Activo'` y devuelve `{success: true, client}`. La evidencia de Fases 10–11 respalda este contrato en el aislado. El candidato no se instaló en la ruta canónica de despliegue ni se desplegó.

## Baseline reproducible

Se copió el borrador respaldado como `supabase/migrations-candidate/20261002000000_initial_production_baseline_candidate.sql`, con advertencia explícita de que no se aplicó y no está validado desde cero. Incluye los objetos capturados en la baseline: cinco tablas, restricciones, RLS, policies, funciones, triggers y ACL de tablas/funciones. No incluye datos productivos, usuarios, secretos, `reset-test-users` ni credenciales SMTP.

Límites que impiden llamarla reproducible hoy:

1. La evidencia de extensiones y sus versiones es comentario, no instalación verificada; deben confirmarse dependencias y disponibilidad en Supabase limpio.
2. La baseline presupone esquemas/roles gestionados por Supabase y `auth.users`; algunos privilegios predeterminados, grants de esquema y ACL completas no estaban capturados.
3. La captura observó grants amplios, incluidos permisos de tabla para `anon`. El candidato se endureció: revoca permisos de tablas de `PUBLIC`/`anon`, omite operaciones no usadas por el frontend (`DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) y concede a `authenticated` solo SELECT/INSERT/UPDATE según el uso leído en el frontend. `service_role` recibe SELECT/INSERT/UPDATE en `clients` y `profiles`, y SELECT en `programs`, según las consultas/escrituras de `invite-client` y `activate-client`. Las policies continúan limitando filas para `authenticated`; `service_role` conserva el bypass inherente a ese rol. La validación contra una base limpia está pendiente.
4. Auth, proveedores, emails, URLs, SMTP, usuarios, Storage y secretos están fuera de esta baseline.
5. El `supabase` CLI no está disponible y no se reinstaló; por tanto, el archivo es candidato SQL local y no una migración validada/creada por CLI.

**Necesidad de `anon`:** ninguna concesión directa de tabla ni de ejecución de funciones queda justificada por el frontend capturado. Las operaciones Auth anónimas (invitación aceptada, registro/login/recuperación) van por Auth API; las consultas de la aplicación requieren usuario autenticado y las policies están dirigidas a `authenticated`. `invite-client` exige JWT y verifica `profiles.role='trainer'`. Por eso `anon` no recibe grants sobre las tablas/funciones de la app. `authenticated` obtiene solo los permisos DML usados; `service_role` solo los usados por las Edge Functions. El Data API requiere grants explícitos en proyectos nuevos; la política oficial nueva hace que las tablas públicas no queden expuestas automáticamente, lo que respalda elegir grants por rol y no copiar indiscriminadamente los defaults históricos ([cambio oficial de Supabase](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)).

No se incluyó seed dentro de la migración. `supabase/seed.sql` queda como fixture sintética separada para un entorno de pruebas, sujeto a revisión antes de usarse.

### Configuración gestionada que no sale de esta migración

- Ajustes de Auth: proveedores, confirmación/registro, Site URL, redirect URLs, plantillas y configuración SMTP. Requieren exportación/configuración del proyecto y sus credenciales SMTP deben cargarse por un gestor seguro.
- Variables administradas por la plataforma para Edge Functions (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`): no guardar sus valores en Git. La invitación puede necesitar `APP_URL`/`SITE_URL` si la llamada no incluye `redirectTo`.
- `verify_jwt=true` está documentado en `supabase/config.toml`, pero desplegar los handlers requiere una acción explícita de funciones; no ocurrió por el bloqueo de creación del proyecto.
- URL del proyecto, API keys, límites/planes, dominios personalizados, DNS, SMTP, configuración de red/SSL, Storage buckets/objetos y otros servicios administrados no se reproducen con SQL de tablas.
- La captura vio `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` y `plpgsql`. No se observó una dependencia de las tres primeras en los objetos de aplicación capturados; `plpgsql` es la extensión de lenguaje base, y Vault/statistics son servicios/extensiones de plataforma. No se emiten `CREATE EXTENSION` sin confirmar necesidad y disponibilidad en el proyecto de destino.

## Regresión local

`phase12-candidates/tests/phase12-regressions.test.mjs`: 8/8 checks PASS con el runtime Node empaquetado. Comprueba además que el cleanup conserva `keep=legit`, otros valores de `flow` y hash, y no contiene recarga ni logout. Build local de Vite: PASS (1.741 módulos, chunk JS 721,98 kB; advertencia de chunk grande y `__dirname`). `tsc --noEmit`: PASS. La repetición en vivo del guard huérfano y del refresh real tras activación está cerrada PASS; se usaron identidades sintéticas y el propietario introdujo la contraseña localmente.

## Respuestas solicitadas

1. **Versión candidata de `activate-client`:** GitHub/main con el `catch` defensivo añadido; hash local en el manifiesto. No es autorización de despliegue.
2. **Fix candidato del redirect:** `/?flow=activate`, tokens únicamente en el hash que gestiona Supabase.
3. **ClientHome sin fila `clients`:** no sintetizar ni escribir; mostrar “Cuenta pendiente de vinculación” y permitir logout. Durante activación, permitir ClientActivate; después recargar el vínculo antes de abrir ClientApp normal.
4. **`reset-test-users`:** excluida del paquete canónico y no incluida en GitHub/main capturado. No puede afirmarse su estado de producción actual; el inventario productivo capturado no la listaba activa.
5. **Baseline desde cero:** todavía no reproducible/verificada; archivo candidato, prueba limpia BLOCKED.
6. **Para abandonar AI Studio:** revisar ACL heredadas, capturar faltantes de grants/extensiones/Auth, validar baseline en un proyecto Supabase nuevo, reconciliar y probar candidatos allí, elegir hosting/dominio, configurar URLs/Auth/APP_URL y ejecutar regresión E2E bajo el dominio nuevo.
7. **Acciones futuras sobre producción:** aplicar migrations, desplegar Edge Functions/frontend, cambiar Auth Site URL/redirects, SMTP/email o secrets, cambiar DNS y/o restaurar usuarios/datos. Ninguna se realizó aquí.

## Intento de proyecto limpio posterior

La creación fue solicitada en la única organización disponible y el coste devuelto por Supabase fue 0/mes; el propietario confirmó ese importe. Supabase devolvió error: límite máximo de 2 proyectos gratuitos activos alcanzado. No se creó recurso. Para reanudar sin alterar los proyectos existentes, el propietario debe habilitar capacidad de proyecto adicional (o proveer otra organización donde crear un proyecto temporal); cualquier coste nuevo requiere confirmación. Hasta entonces no hay proyecto de destino para migración, verificación de catálogo ni despliegue de funciones.
