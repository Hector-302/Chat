# Plan de persistencia para chats y usuarios

## Evaluación de opciones actuales
- Las cookies en el navegador solo sirven para almacenar estado efímero del lado del cliente. Permiten mantener sesiones activas, pero no son adecuadas para conservar historiales ni datos de usuarios, y exponen el riesgo de mantener chats "huérfanos" cuando se reinicia el backend.
- Para garantizar que los mensajes, usuarios y sesiones se conserven entre reinicios y escalen a múltiples instancias, es preferible persistir los datos en una base de datos relacional.
- PostgreSQL encaja bien porque ofrece integridad referencial, transacciones y buenas opciones de indexación para consultas por usuario/conversación.

## Modelo de datos propuesto
- **users**: id, email/username, hash de contraseña (si aplica), fecha de creación, último acceso.
- **conversations**: id, owner_id (FK a users), título/alias, timestamps de creación/actualización, estado (activo/archivado).
- **participants**: conversation_id (FK), user_id (FK), rol (owner/guest), timestamps.
- **messages**: id, conversation_id (FK), sender_id (FK), contenido, tipo (texto/sistema), timestamps, borrado lógico opcional.
- **sessions/tokens**: para autenticación (JWT o tabla de sesiones) si se requiere control de expiración y revocación.

## Decisiones recomendadas
1. Usar PostgreSQL como almacén principal para usuarios, conversaciones y mensajes.
2. Mantener una capa de autenticación basada en JWT firmados en el backend, almacenando en DB la huella/jti y expiración para permitir revocación.
3. El frontend sólo conservará en cookies el token de sesión (con atributo `HttpOnly`, `Secure`, `SameSite=Lax/Strict`) o en `sessionStorage` si se prefiere no persistir entre cierres, pero el historial siempre se consultará al backend.

## Tareas modulares y comprobables
1. **Configurar infraestructura de base de datos**
   - Añadir dependencias de PostgreSQL (driver JDBC o starter) y propiedades de conexión por entorno.
   - Crear scripts de migración (Flyway/Liquibase) para las tablas `users`, `conversations`, `participants`, `messages` y `revoked_tokens`.
2. **Definir entidades y repositorios**
   - Implementar entidades JPA para cada tabla con sus relaciones (OneToMany/ManyToMany según diseño de participantes).
   - Crear repositorios Spring Data con consultas para historiales por usuario y conversación, paginadas por fecha.
3. **Autenticación y manejo de sesiones**
   - Implementar registro/login con hashing seguro (BCrypt) y emisión de JWT.
   - Añadir filtros/guards en los endpoints y en el WebSocket handshake para validar el JWT y asociar el usuario autenticado a la sesión.
4. **API de conversaciones y mensajes**
   - Exponer endpoints REST para crear/renombrar/archivar conversaciones y listar conversaciones del usuario.
   - Adaptar el flujo WebSocket/REST para persistir cada mensaje en `messages` y devolver el historial al entrar en una sala.
5. **Eliminación y retención**
   - Implementar borrado de mensajes/conversaciones por propietario (borrado lógico con marca `deleted_at` para no perder trazabilidad).
   - Añadir job opcional de limpieza física o política de retención.
6. **Sincronización cliente**
   - Actualizar el frontend para que, tras autenticarse, cargue las conversaciones y mensajes desde la API en vez de depender de cookies locales.
   - Gestionar expiración de tokens (refresh o re-login) y mostrar estados de sesión caducada.
7. **Pruebas y validación**
   - Tests unitarios de repositorios y servicios de dominio (creación de conversación, envío de mensaje, borrado lógico).
   - Tests de integración del WebSocket con autenticación y persistencia (pueden usar perfiles de prueba con PostgreSQL embebido o Testcontainers).
   - Flujos E2E básicos: registro ➜ login ➜ crear conversación ➜ enviar/recibir ➜ eliminar mensaje.

## Comprobaciones rápidas sugeridas
- Verificar que, tras reiniciar el backend, las conversaciones y mensajes siguen presentes en la base de datos.
- Asegurar que un usuario no autenticado no puede suscribirse ni enviar mensajes a un canal WebSocket protegido.
- Confirmar que el borrado lógico oculta el mensaje en el historial pero mantiene trazabilidad en DB para auditoría.
