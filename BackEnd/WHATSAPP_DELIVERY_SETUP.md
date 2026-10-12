# Notificaciones de delivery por WhatsApp

El dashboard puede notificar al teléfono de contacto del pedido usando WhatsApp Business Cloud API. No automatizamos WhatsApp Web personal: requiere una sesión interactiva y no es una integración servidor estable.

## Configuración

1. Configura un número de WhatsApp Business en Meta Developers y habilita WhatsApp Cloud API.
2. En `BackEnd/.env`, añade `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_GRAPH_API_VERSION`.
3. Para notificar fuera de la ventana de atención de 24 horas, crea y aprueba una plantilla con idioma `es` y 7 variables de cuerpo, en este orden: nombre del cliente, número de pedido, factura, conductor, teléfono del conductor, dirección confirmada y ubicación/Maps.
4. Configura `WHATSAPP_DELIVERY_TEMPLATE_NAME` y `WHATSAPP_DELIVERY_TEMPLATE_LANGUAGE` con los valores aprobados en Meta.
5. Reinicia el backend después de actualizar el archivo `.env`.

Sin credenciales, o si Meta rechaza el envío, el dashboard conserva el pedido y muestra un enlace `wa.me` con el mensaje listo para enviar manualmente. El estado de notificación queda indicado en el pedido.
