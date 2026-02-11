# Manual de Usuario: UnifiedBot Dashboard

Bienvenido a tu panel de control de IA. Aquí aprenderás a configurar tu bot y gestionar tus conversaciones paso a paso.

## 1. Acceso al Sistema
- **URL de Login**: Habitualmente `http://tu-dominio.com/`.
- Introduce tus credenciales de administrador proporcionadas por el sistema.

## 2. Configuración de tu Empresa
Para que el bot sepa qué responder, debes "entrenarlo":
1. Ve a la sección **Empresa** (icono de edificio).
2. **Nombre y descripción**: Define la personalidad de tu bot.
3. **Instrucciones**: Explícale qué debe hacer (Ej: "Eres un vendedor de seguros, sé amable y profesional").
4. **Entrenamiento (Assets)**: Sube archivos PDF o TXT con la información de tus productos o servicios. El bot leerá estos archivos para responder dudas.

## 3. Gestión de Chats (Live Chat)
La sección **Chat** es donde ocurre la magia:
- **Filtros**: Puedes ver todos los chats o filtrar por plataforma (Telegram, WhatsApp, etc.).
- **Modo Humano (Pausa)**: Si quieres intervenir en una charla, haz clic en el icono de **Reloj** o **Pausa**. Elige cuánto tiempo quieres que el bot guarde silencio (minutos, horas, días o indefinido).
- **Respuestas Manuales**: Una vez pausado el bot, el campo de texto se habilitará para que tú escribas directamente al cliente.
- **Multimedia**: Puedes enviar fotos y videos usando el icono del clip. Verás una previsualización de tus archivos antes de enviarlos.

## 4. Gestión Masiva (Selección Múltiple)
Si tienes muchos bots pausados y quieres reactivarlos todos:
1. Usa el filtro **"Pausados"**.
2. Marca la casilla (checkbox) de cada chat que quieras reactivar.
3. Haz clic en el botón inferior **"Reanudar Bot"**.

## 5. Canales de Comunicación y Capacidades
Tu bot es omnicanal y puede atender en múltiples frentes simultáneamente:

### ✅ Instagram y Facebook Messenger
- **Atención 24/7**: Responde automáticamente preguntas frecuentes (precios, ubicación, horarios).
- **Multimedia Visual**: Envía fotos de tus productos, platos o espacios cuando el cliente lo solicita.
- **Navegación Intuitiva**: Usa botones interactivos (si la plataforma lo permite) para guiar al usuario.

### ✅ Telegram
- **Experiencia Avanzada**: Soportamos menús, botones y comandos rápidos.
- **Notas de Voz**: ¡Tu bot tiene oído! Puede escuchar audios de los clientes, transcribirlos y responderlos como si fuera texto.

### 5. Configuraciones de Canales (Redes Sociales)

El bot soporta integración nativa con las principales plataformas de Meta y Telegram.

#### 5.1 Modo "Tu Propia App" (Independencia Total)
Para garantizar la independencia de cada empresa, el sistema permite que cada cliente utilice su propia **Meta App**.

**Pasos para conectar:**
1.  **Callback URL:** En `Ajustes > Integraciones`, obtén tu URL única (terminada en tu ID de empresa).
    *   Ejemplo: `https://panel.tudominio.com/webhooks/meta/123`
2.  **Verify Token:** Define una contraseña segura en el campo "Verify Token" del panel y guárdala.
3.  **Meta Developers:** Ve a la configuración de Webhooks de tu App en Facebook, pega la URL y el mismo Token que definiste.

#### 5.2 Guía de "App Review" (Copia y Pega)
Meta te obliga a justificar cada permiso. Aquí tienes la "Chuleta" exacta para aprobar.

> **⚠️ Importante:** Como Meta te exige `pages_show_list` para poder usar `pages_read_engagement`, debes solicitar **LOS 3** siguientes:

##### 1. `pages_messaging` (El Chat)
*   **¿Cómo se usa?:** Selecciona: *"La app usa esto para enviar/recibir mensajes de chat automatizados con usuarios."*
*   **Justificación (Texto):**
    > "Our application acts as a customer service assistant. It allows businesses to automate responses to their clients on Messenger. We need this permission to listen to the `messages` webhook and send replies using the Send API. Without this, the bot cannot function."
*   **Video:** Graba tu pantalla enviando un "Hola" al bot y mostrando cómo el bot responde automáticamente.

##### 2. `pages_show_list` (La Dependencia)
*   **¿Cómo se usa?:** *"Requerido técnicamente por Meta para habilitar pages_read_engagement."*
*   **Justificación (Texto):**
    > "We are requesting this permission primarily as a technical dependency required by Meta to use `pages_read_engagement`. Additionally, it allows our system to validate that the user is an admin of the page they are trying to connect via the manual token input."
*   **Video:** Muestra la pantalla de Ajustes donde se ve el campo "Facebook Page ID". Explica (en voz o texto) que el sistema valida internamente la propiedad de la página.

##### 3. `pages_read_engagement` (Nombres de Usuario)
*   **¿Cómo se usa?:** *"Para personalizar la respuesta con el nombre del usuario."*
*   **Justificación (Texto):**
    > "We use this permission to access the user's public profile (specifically `first_name`) to personalize the conversation. For example, the bot replies 'Hello John' instead of a generic greeting. This improves the user experience."
*   **Video:** Graba al bot respondiendo algo que incluya el nombre del usuario (Ej: "Hola Admin, ¿en qué te ayudo?").

> **Nota:** Si Meta rechaza `pages_show_list` por "no haber menú de selección de páginas", deberás eliminar tanto `pages_show_list` como `pages_read_engagement` y quedarte SOLO con `pages_messaging` (el bot funcionará, pero no dirá los nombres de los usuarios).

#### 5.3 Telegram
1.  Crea un bot con `@BotFather` en Telegram.
2.  Obtén el **Bot Token**.
3.  Ingrésalo en la sección de Telegram en Ajustes.

#### 5.3 Instagram & Facebook Messenger
#### 5.4 🔑 ¿Cómo obtener el "Facebook Access Token"?
El token es la "llave" que permite a tu bot enviar mensajes. Sigue estos pasos para obtener uno que no caduque pronto:

1.  **Entra al [Explorador de la Graph API](https://developers.facebook.com/tools/explorer/)**.
2.  A la derecha, selecciona tu **Meta App**.
3.  En "Usuario o Página", selecciona **"Token de acceso a la página"**.
4.  Te pedirá permisos: Acepta y selecciona la Fanpage que quieres conectar.
5.  Se generará un código largo en el campo de arriba. **Cópialo**.
    *   *Nota:* Este token suele durar solo 1 hora (Token de Corta Duración).
6.  **(Recomendado) Convertir a Token de Larga Duración (60 días):**
    *   Haz clic en el icono de información `(i)` junto al token.
    *   Haz clic en "Abrir en la herramienta de tokens de acceso".
    *   Verás un botón azul que dice **"Ampliar token de acceso"**. Haz clic.
    *   Copia el **nuevo token** que aparezca. Ese es el que debes pegar en el panel de tu bot.

> **Configuración Final:**
> *   **Instagram:** Requiere Token de Página + ID de Cuenta Empresarial de Instagram.
> *   **Messenger:** Requiere Token de Página + ID de Página de Facebook.

#### 5.5 Instrucciones de Prueba para el Revisor (Testing Instructions)
Copia y pega este texto en el campo de "Instrucciones de prueba". **Asegúrate de crear primero un usuario 'demo' en tu panel.**

**Texto a Copiar:**
> **Credentials for Testing Platform:**
> *   **URL:** [TU_URL_DEL_DASHBOARD]
> *   **User:** demo@test.com
> *   **Password:** [TU_CONTRASEÑA]
>
> **Step-by-Step Instructions:**
> 1.  **Login:** Go to our platform URL and log in with the credentials provided above.
> 2.  **Verify Connection:** Go to "Settings" (Ajustes) > "Integration". You will see that a Facebook Page is already connected via our "Manual Token" system.
> 3.  **Test the Bot:** Go to our Facebook Page: [ENLACE_A_TU_FANPAGE] (e.g., https://m.me/TuPagina)
> 4.  **Interaction:** Send a message saying "Hola" or "Info".
> 5.  **Result:** The bot (powered by our webhook) will automatically reply with a greeting and menu options.
> 6.  **Personalization (pages_read_engagement):** Verify that the bot replies using your public name (e.g., "Hola [Name]").

> **⚠️ Importante:** Antes de enviar esto, asegúrate de que el usuario `demo` existe en tu sistema y que TU página de Facebook está conectada y funcionando con el bot.
