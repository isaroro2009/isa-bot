# Herramientas en vistas dedicadas con diseño espacial

## Resultado
- Cada herramienta de los tres bloques abrirá en una ventana dedicada, separada del chat principal.
- Se conservarán las funciones, datos guardados, restricciones PRO y acciones actuales de cada herramienta.
- Las vistas dedicadas compartirán un diseño oscuro espacial de alta gama: fondo violeta-negro, superficies translúcidas, bordes suaves, acentos morados y dorados, y adaptación móvil.

## Implementación
1. **Apertura dedicada**
   - Añadir una función común para abrir herramientas mediante una URL identificable.
   - Cambiar únicamente los botones de herramientas en ambos menús para usar esa apertura.
   - Mantener el aviso PRO actual cuando una herramienta requiera suscripción.
   - Cerrar la ventana dedicada al salir de una herramienta, con retorno seguro a IsaBot si el navegador bloquea el cierre.

2. **Modo inmersivo**
   - Detectar la herramienta solicitada al cargar la nueva ventana y abrir su contenido existente.
   - Ocultar chat, cabecera, barra lateral y controles generales en esa vista, dejando solo la herramienta.
   - Aplicar el mismo tratamiento a Mi Día, Tareas, Planeador, Pomodoro, Outlines, Paletas, Notas, Agente PDF, Regalo Semanal y Guía de IA Responsable.
   - Mantener el Portal de Padres en su ruta dedicada y actualizarlo con la misma apariencia.

3. **Sistema visual compartido**
   - Crear variables semánticas para fondo espacial, paneles, texto, violeta, oro, bordes y sombras.
   - Unificar tarjetas, formularios, botones, calendarios, listas, indicadores y estados de cada herramienta.
   - Incluir foco visible, contraste legible, desplazamiento interno y tamaños táctiles adecuados.

4. **Verificación**
   - Comprobar que todos los botones abren la herramienta correcta fuera del chat.
   - Probar una herramienta gratuita, una PRO, la Guía de IA Responsable y el Portal de Padres.
   - Revisar escritorio y móvil, sin desbordamientos ni pérdida de funcionalidad.

## Detalles técnicos
- Se reutiliza la lógica actual de cada panel para evitar regresiones; la nueva ventana carga el mismo módulo con un parámetro de herramienta.
- No se modifican reglas de negocio, precios, autenticación, datos ni comportamiento del chat.
