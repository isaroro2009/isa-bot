# Ampliar Noticias, Academia y Temas

## Resultado
- Noticias con idioma propio dentro del panel y texto ampliado debajo de cada titular.
- Un creador de cursos a medida dentro de IsaAcademy, con módulo, quiz y diploma al completar el 100%.
- Ocho temas predefinidos y un creador de tema personalizado a partir de una descripción.

## Cambios
1. **Noticias Tech**
   - Añadir el selector visible `Inglés / Español` en la cabecera, con estado independiente `newsLang` y estilos de selección/hover claros.
   - Ampliar cada noticia con su descripción disponible; conservar el resumen actual como respaldo cuando una fuente no entregue texto completo.
   - Mostrar título y descripción en el idioma elegido, reutilizando las traducciones guardadas para evitar solicitudes repetidas.

2. **IsaAcademy**
   - Añadir en la vista principal un área para describir la temática del curso personalizado.
   - Generar un módulo temporal con contenido y quiz, manteniendo intactas las rutas, límites, XP y progreso existentes.
   - Calcular el avance del curso personalizado y mostrar un diploma imprimible cuando el quiz quede aprobado y el progreso alcance 100%.

3. **Temas**
   - Agregar dos temas predefinidos al selector y sus variables completas de fondo, texto, paneles, mensajes y acento.
   - Añadir `Crear Tema con IA`, desplegando un campo compacto para describir el estilo.
   - Generar y validar tres colores HEX —fondo, texto y acento— y aplicarlos como variables CSS del documento, con persistencia local y contraste legible.

4. **Validación**
   - Probar los botones de idioma, contenido expandido, creación/completado del curso y diploma.
   - Probar los ocho temas, la creación personalizada y su persistencia tras recargar.
   - Revisar escritorio y móvil sin cambiar el layout existente.

## Detalles técnicos
- Las generaciones se harán en el servidor mediante Lovable AI; la clave nunca llegará al navegador.
- Los errores de generación se mostrarán en el panel correspondiente sin borrar la descripción escrita por el usuario.
- No se modificarán las reglas actuales de monetización, progreso ni autenticación.
