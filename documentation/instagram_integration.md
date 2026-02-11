# Guía de Integración con Instagram

Para conectar el bot con Instagram, seguimos el flujo de la **Instagram Graph API** dentro de Meta for Developers.

## Requisitos Previos
1. Una cuenta de **Instagram Business** (no personal ni de creador).
2. Una **Página de Facebook** vinculada a esa cuenta de Instagram.
3. Una cuenta en [Meta for Developers](https://developers.facebook.com/).

## Paso 1: Crear la App en Meta
1. Ve a "Mis aplicaciones" -> "Crear aplicación".
2. Selecciona el tipo "Otros" -> "Siguiente".
3. Elige **Empresa** (Business) como tipo de aplicación.
4. Asigna un nombre (Ej: `UnifiedBot_Instagram`) y vincula tu cuenta comercial.

## Paso 2: Configurar el Producto
1. En el panel lateral, haz clic en "Añadir producto".
2. Busca **Instagram Graph API** y configúralo.
3. También añade el producto **Messenger** (ya que Instagram usa la arquitectura de mensajería de Messenger).

## Paso 3: Configurar Webhooks
1. En el menú de Messenger -> Configuración de Instagram:
   - URL de devolución de llamada: `https://tu-dominio.com/api/webhooks/instagram` (cuando lo despleguemos en VPS).
   - Token de verificación: Elige una clave secreta (ej: `mi_clave_secreta`).
2. Suscríbete a los campos: `messages`, `messaging_postbacks`, `messaging_optins`.

## Paso 4: Obtener Tokens
1. Usa el **Explorador de la Graph API** para obtener el `Access Token` de la página.
2. Este token debe guardarse en el Dashboard (en la sección de Ajustes de Empresa que creamos).

## Paso 5: Permisos Críticos
Debes solicitar revisión para estos permisos antes de que usuarios externos puedan usarlo:
- `instagram_basic`
- `instagram_manage_messages`
- `pages_manage_metadata`
- `pages_messaging`

> [!NOTE]
> Actualmente el backend tiene la estructura lista en `botManager.js` para recibir el canal `instagram`, solo falta terminar el controlador de Webhooks específico.
