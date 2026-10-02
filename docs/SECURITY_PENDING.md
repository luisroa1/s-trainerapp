# Seguridad pendiente

- Una utilidad histórica de pruebas encontrada en un archivo de rescate contenía una credencial hardcodeada. Su código y valor se excluyen de esta propuesta. No ejecutar, publicar ni versionar copias de esa utilidad; revisar el incidente mediante un procedimiento de seguridad separado.
- No se ha podido confirmar el estado actual de despliegue de esa utilidad; la evidencia local disponible es una captura histórica. No contiene datos suficientes para asociar identidades con certeza.
- El borrador de baseline de permisos refleja ACL de producción capturadas, pero la propuesta las reduce según el uso observado. Los grants y policies deben validarse en un proyecto limpio antes de migrar.
- No incluir credenciales SMTP, claves API, tokens, `service_role`, datos reales, exportaciones Auth ni backups en Git.
