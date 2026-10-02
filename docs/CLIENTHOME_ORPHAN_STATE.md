# ClientHome: identidad cliente sin fila vinculada

## Causa

Fase 11 reprodujo el fallo en una identidad sintética `profile.role=client` con cero filas `public.clients` vinculadas: ClientHome intentaba leer `activeClient.avatarUrl` cuando `activeClient` era `null`, produciendo pantalla blanca (`TypeError: Cannot read properties of null (reading 'avatarUrl')`).

En `AppContext.tsx`, la rama de cliente deriva `activeClient` de `realClient` o de una fila local existente y, si no encuentra ninguna, devuelve `null` aunque el tipo está declarado como `ClientData`. `App.tsx` enruta un usuario autenticado con rol `client` a `ClientApp`; si la pantalla normal renderiza ClientHome sin controlar ese valor, el acceso a propiedades falla.

## Candidato local

Archivo: `../phase12-candidates/frontend/src/components/client/ClientApp.tsx`.

- Si no hay `activeClient` y no se está procesando `activate`, renderiza el aviso controlado “Cuenta pendiente de vinculación”.
- El aviso no crea ni actualiza filas y no altera ownership. Ofrece logout con `signOut()` para volver a AuthScreen.
- La pantalla `activate` queda accesible incluso antes de que exista una fila cargada en contexto. Al completar activación, intenta volver a cargar el registro vinculado por el UID autenticado; solo entonces navega a la pantalla principal. Si sigue sin existir un vínculo, permanece el aviso controlado.

## Verificación

- Regresión local estática: PASS; comprueba que la guarda permite `activate`, ofrece logout y no incluye operaciones de escritura a Supabase.
- Build Vite local del candidato: PASS.
- Reproducción original: PASS en Fase 11, documentada en `PHASE11_FRONTEND_E2E_RESULTS.md`.
- El inventario read-only confirmó dos perfiles sintéticos `client` sin fila `clients`; uno se usó para validar el estado huérfano con su propia sesión autenticada.
- E2E del estado huérfano/logout: PASS en vivo con JWT real de la identidad sintética atacante en el proyecto aislado. La pantalla “Cuenta pendiente de vinculación” se mostró, no hubo pantalla blanca ni escritura automática y el botón de logout devolvió a AuthScreen. No se relajó ninguna policy; el acceso a datos ajenos permaneció vacío.

Este parche permanece en `phase12-candidates/`; no se aplicó a GitHub remoto, AI Studio ni producción.
