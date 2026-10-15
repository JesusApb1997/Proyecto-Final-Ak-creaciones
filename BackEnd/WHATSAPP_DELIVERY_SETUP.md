# Notificaciones de delivery por WhatsApp

Al pulsar **Verificar, asignar y avisar al cliente**, el backend envía el pedido, el detalle de la factura, el total, la ubicación y los datos del conductor al teléfono registrado por el cliente. Intenta primero WhatsApp Web y después Cloud API; si ninguno está conectado, devuelve un enlace `wa.me` para envío manual.

## Vincular WhatsApp Web

1. Inicia el backend en una máquina que pueda mantener el proceso y el directorio de sesión.
2. Abre WhatsApp en el teléfono que enviará los avisos y entra en **Dispositivos vinculados > Vincular un dispositivo**.
3. Escanea el QR que aparece en la consola del backend. La sesión se guarda en `BackEnd/.wwebjs_auth` y se reutiliza tras reiniciar.
4. Configura `WHATSAPP_DEFAULT_COUNTRY_CODE` en `BackEnd/.env` si los teléfonos de los pedidos usan otro país (por defecto, Venezuela `58`).
5. El backend busca Chrome/Edge del sistema y luego el Chromium de Puppeteer. Si tu navegador está en una ruta no estándar, configura `PUPPETEER_EXECUTABLE_PATH` con la ruta completa al ejecutable, por ejemplo `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe` en Windows.

### Si no aparece el QR después de desvincular el teléfono

El QR se imprime en la terminal del **BackEnd**, no en la del FrontEnd. Solo un proceso de BackEnd puede usar la sesión `ak-creaciones` a la vez. Si aparece un error indicando que el navegador ya está abierto o que el `userDataDir` está en uso:

1. Detén los procesos anteriores del BackEnd y cierra la ventana de Chrome/Web WhatsApp que hayan dejado abierta.
2. Inicia el BackEnd de nuevo y espera el evento del QR.
3. Si el teléfono ya revocó la sesión y aun así no se genera QR, detén BackEnd y Chrome primero y elimina únicamente `BackEnd/.wwebjs_auth/session-ak-creaciones`. Al iniciar de nuevo, se creará una sesión nueva y se imprimirá otro QR.

No elimines esa carpeta mientras Chrome o BackEnd sigan abiertos: contiene la sesión local autenticada.

WhatsApp Web no es la API oficial de Meta y puede desconectarse o limitar la cuenta si se automatiza en exceso. No borres ni publiques `.wwebjs_auth`: contiene credenciales de la sesión. Para hosting efímero/serverless, usa Cloud API.

## Configuración

1. Configura un número de WhatsApp Business en Meta Developers y habilita WhatsApp Cloud API.
2. En `BackEnd/.env`, añade `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_GRAPH_API_VERSION`.
3. Para notificar fuera de la ventana de atención de 24 horas, crea y aprueba una plantilla con idioma `es` y 7 variables de cuerpo, en este orden: nombre del cliente, número de pedido, factura y detalle, conductor, teléfono del conductor, dirección confirmada y ubicación/Maps.
4. Configura `WHATSAPP_DELIVERY_TEMPLATE_NAME` y `WHATSAPP_DELIVERY_TEMPLATE_LANGUAGE` con los valores aprobados en Meta.
5. Reinicia el backend después de actualizar el archivo `.env`.

Con ambas integraciones desconectadas, el dashboard conserva el pedido y muestra un enlace `wa.me` con el mensaje listo para enviar manualmente. El estado de notificación queda indicado en el pedido.
