CREATE TABLE public.academy_tracks (
  slug text PRIMARY KEY,
  title text NOT NULL,
  emoji text NOT NULL DEFAULT '📘',
  description text NOT NULL DEFAULT '',
  premium boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_slug text NOT NULL REFERENCES public.academy_tracks(slug) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  emoji text NOT NULL DEFAULT '✨',
  body text NOT NULL,
  quiz jsonb NOT NULL DEFAULT '{"questions":[]}'::jsonb,
  xp integer NOT NULL DEFAULT 10,
  premium boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_lessons_track_idx ON public.academy_lessons(track_slug, sort_order);

CREATE TABLE public.academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  track_slug text NOT NULL,
  status text NOT NULL DEFAULT 'done',
  xp integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX academy_progress_user_idx ON public.academy_progress(user_id);

CREATE TABLE public.academy_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_day date,
  hearts integer NOT NULL DEFAULT 5,
  hearts_day date,
  lessons_today integer NOT NULL DEFAULT 0,
  today date,
  total_xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.academy_tracks TO authenticated;
GRANT ALL ON public.academy_tracks TO service_role;
GRANT SELECT ON public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_progress TO authenticated;
GRANT ALL ON public.academy_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_streaks TO authenticated;
GRANT ALL ON public.academy_streaks TO service_role;

ALTER TABLE public.academy_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_tracks_read" ON public.academy_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy_lessons_read" ON public.academy_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "academy_progress_own" ON public.academy_progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "academy_streaks_own" ON public.academy_streaks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.academy_tracks (slug, title, emoji, description, premium, sort_order) VALUES
('ia', 'Fundamentos de IA', '🤖', $t$Entiende qué es la inteligencia artificial, cómo piensa y para qué te sirve hoy.$t$, false, 1),
('prompting', 'Prompting Pro', '✍️', $t$Aprende a pedirle cosas a una IA y obtener resultados de nivel profesional.$t$, false, 2),
('dev', 'Programación desde cero', '🧑‍💻', $t$Tus primeros pasos en código: lógica, web y cómo leer un error sin miedo.$t$, true, 3),
('nocode', 'No-code y Automatización', '🚀', $t$Crea apps, webs y automatizaciones sin escribir una línea de código.$t$, true, 4);

INSERT INTO public.academy_lessons (track_slug, level, title, emoji, body, quiz, xp, premium, sort_order) VALUES
('ia', 1, 'Qué es la inteligencia artificial', '🌱', $t$La inteligencia artificial es software que aprende patrones a partir de muchos ejemplos, en vez de seguir reglas escritas una por una.

Piensa en un cuaderno gigante de ejemplos: la IA lo lee, encuentra regularidades y luego usa esos patrones para responder algo nuevo.

Por eso una IA puede escribir, resumir o traducir sin que nadie le haya programado cada frase posible.$t$, $j${"questions":[{"q":"¿Cómo aprende una IA moderna?","options":["Con reglas escritas una por una","Detectando patrones en muchos ejemplos","Copiando internet en tiempo real"],"answer":1,"explain":"Aprende patrones a partir de datos de ejemplo."},{"q":"¿Qué NO es cierto de la IA?","options":["Puede resumir texto","Entiende el mundo como una persona","Se equivoca a veces"],"answer":1,"explain":"No comprende como un humano: predice a partir de patrones."}]}$j$, 10, false, 1),
('ia', 1, 'Modelos de lenguaje en simple', '💬', $t$Un modelo de lenguaje predice la siguiente palabra más probable, una y otra vez, hasta formar una respuesta completa.

Eso explica dos cosas: por qué escribe tan natural, y por qué a veces inventa datos con total seguridad. Ese invento se llama alucinación.

Regla de oro: la IA es excelente borrador, mala fuente final. Siempre verifica datos importantes.$t$, $j${"questions":[{"q":"¿Qué hace un modelo de lenguaje?","options":["Busca la respuesta en una base de datos","Predice la siguiente palabra probable","Pregunta a una persona"],"answer":1,"explain":"Genera texto prediciendo token por token."},{"q":"Cuando la IA inventa un dato se llama","options":["Alucinación","Compilación","Indexación"],"answer":0,"explain":"Alucinación: información falsa dicha con seguridad."}]}$j$, 10, false, 2),
('ia', 2, 'Datos: el combustible', '🍚', $t$La calidad de una IA depende de sus datos. Datos sesgados producen respuestas sesgadas.

Tres ideas clave: cantidad (mientras más ejemplos, mejor generaliza), calidad (basura entra, basura sale) y representatividad (si faltan grupos, la IA falla con ellos).

Cuando uses IA para tu proyecto, piensa siempre: ¿con qué información la estoy alimentando?$t$, $j${"questions":[{"q":"Si los datos están sesgados, el modelo","options":["Corrige el sesgo solo","Reproduce el sesgo","Se apaga"],"answer":1,"explain":"El modelo aprende lo que hay en los datos."},{"q":"Basura entra, basura sale se refiere a","options":["La calidad de los datos","La velocidad del servidor","El tamaño del archivo"],"answer":0,"explain":"Habla de la calidad de los datos de entrada."}]}$j$, 10, false, 3),
('ia', 2, 'IA multimodal', '🖼️', $t$Multimodal significa que un mismo modelo entiende varios formatos: texto, imágenes, audio y video.

Eso abre cosas muy prácticas: mandarle una foto de tus apuntes y pedir un resumen, o describir una imagen para que la genere.

IsaBot es multimodal: puedes escribirle, mandarle fotos y hablarle por voz.$t$, $j${"questions":[{"q":"Multimodal quiere decir","options":["Que corre en varios países","Que entiende varios formatos de entrada","Que tiene varios usuarios"],"answer":1,"explain":"Texto, imagen, audio y video en un mismo modelo."},{"q":"Un uso multimodal real es","options":["Resumir la foto de tus apuntes","Cambiar el color de la app","Guardar un archivo"],"answer":0,"explain":"Combina imagen y texto en una sola tarea."}]}$j$, 10, false, 4),
('ia', 3, 'Ética y uso responsable', '🛡️', $t$Usar IA bien es tan importante como saber usarla. Tres reglas básicas:

1. Transparencia: si un texto o imagen es generado, dilo.
2. Privacidad: no pegues datos personales o secretos en un chat.
3. Responsabilidad: la decisión final y sus consecuencias son tuyas, no del modelo.

Con eso ya estás por delante de la mayoría.$t$, $j${"questions":[{"q":"¿Qué NO deberías pegar en un chat de IA?","options":["Un texto público","Datos personales sensibles","Una pregunta de estudio"],"answer":1,"explain":"Nunca compartas datos sensibles."},{"q":"La responsabilidad de una decisión tomada con IA es","options":["Del modelo","Tuya","De nadie"],"answer":1,"explain":"La IA asiste; tú decides."}]}$j$, 15, false, 5),
('ia', 3, 'IA en tu día a día', '⚡', $t$La IA rinde cuando la usas en tareas concretas y repetitivas.

Estudio: resúmenes, cuestionarios de práctica, explicaciones a tu nivel.
Emprender: nombres, textos de venta, análisis de una idea, correos.
Creatividad: lluvia de ideas, guiones, moodboards.

Elige una tarea que hagas cada semana y automatízala con IsaBot esta misma semana.$t$, $j${"questions":[{"q":"¿Dónde rinde más la IA?","options":["Tareas concretas y repetitivas","Decisiones legales finales","Recordar tu contraseña"],"answer":0,"explain":"Brilla en tareas repetitivas y acotadas."},{"q":"Un buen primer uso es","options":["Resumir material de estudio","Firmar contratos","Hacer pagos"],"answer":0,"explain":"Resumir es rápido, útil y verificable."}]}$j$, 15, false, 6),
('prompting', 1, 'Anatomía de un buen prompt', '🧩', $t$Un buen prompt tiene cuatro partes: rol, tarea, contexto y formato.

Ejemplo flojo: escribe sobre marketing.
Ejemplo pro: actúa como estratega de marketing. Escribe 5 ideas de contenido para una tienda de velas artesanales que vende por Instagram. Formato: lista con título y gancho.

Nota la diferencia: la segunda versión no deja nada a la adivinanza.$t$, $j${"questions":[{"q":"¿Qué le falta a escribe sobre marketing?","options":["Contexto y formato","Ortografía","Emojis"],"answer":0,"explain":"Sin contexto ni formato el resultado es genérico."},{"q":"Las cuatro partes de un buen prompt son","options":["Rol, tarea, contexto y formato","Hola, gracias, por favor y chao","Título, cuerpo, cierre y firma"],"answer":0,"explain":"Rol, tarea, contexto y formato."}]}$j$, 10, false, 1),
('prompting', 1, 'Dar contexto que sirva', '🎯', $t$El contexto útil responde: para quién es, con qué objetivo, en qué tono y de qué largo.

Compara: hazme un correo, contra: hazme un correo de 120 palabras para una clienta que no respondió mi cotización, tono cercano pero profesional, con un cierre que invite a agendar llamada.

Más contexto no es más palabras: es más decisiones tomadas por ti.$t$, $j${"questions":[{"q":"Contexto útil incluye","options":["Audiencia, objetivo, tono y largo","Tu nombre completo","La hora del día"],"answer":0,"explain":"Esas cuatro cosas guían la respuesta."},{"q":"Más contexto significa","options":["Escribir más largo siempre","Tomar más decisiones tú","Usar palabras raras"],"answer":1,"explain":"Defines tú lo que no quieres dejar al azar."}]}$j$, 10, false, 2),
('prompting', 2, 'Iterar en vez de rendirse', '🔁', $t$El primer resultado casi nunca es el final. Iterar es corregir con instrucciones cortas.

Frases que funcionan: más corto, menos formal, dame 3 versiones, ahora en tono de mentor, quita los adjetivos, hazlo para principiantes.

Truco pro: pide que critique su propia respuesta y la mejore. Suele subir la calidad de inmediato.$t$, $j${"questions":[{"q":"Si el resultado no te gusta, lo mejor es","options":["Empezar de cero en otro chat","Corregir con una instrucción corta","Aceptarlo igual"],"answer":1,"explain":"Iterar es más rápido y mantiene el contexto."},{"q":"Un truco para subir la calidad es","options":["Pedirle que critique y mejore su respuesta","Escribir en mayúsculas","Repetir el mismo prompt"],"answer":0,"explain":"La autocrítica guiada mejora el resultado."}]}$j$, 10, false, 3),
('prompting', 2, 'Prompts con ejemplos', '📎', $t$Darle 1 a 3 ejemplos del resultado que quieres se llama few-shot y es la forma más rápida de fijar un estilo.

Estructura: aquí tienes 2 ejemplos de cómo escribo mis títulos, ahora genera 5 más con ese mismo estilo.

Si te cuesta explicar tu estilo con palabras, muéstralo con ejemplos.$t$, $j${"questions":[{"q":"Dar ejemplos en el prompt se llama","options":["Few-shot","Backend","Deploy"],"answer":0,"explain":"Few-shot: aprender del ejemplo dado."},{"q":"Los ejemplos sirven sobre todo para","options":["Fijar el estilo y formato","Acelerar el servidor","Ahorrar batería"],"answer":0,"explain":"Comunican estilo mejor que una descripción."}]}$j$, 10, false, 4),
('prompting', 3, 'Encadenar tareas', '⛓️', $t$Las tareas grandes salen mejor por partes. En vez de pedir todo de una, encadena.

Ejemplo: 1) lista los temas, 2) elige los 3 mejores y explica por qué, 3) desarrolla el elegido, 4) revisa y corrige.

Cada paso usa el resultado del anterior y tú controlas la dirección en cada etapa.$t$, $j${"questions":[{"q":"Encadenar tareas significa","options":["Dividir un trabajo grande en pasos","Abrir muchos chats","Pedir todo en un solo mensaje"],"answer":0,"explain":"Cada paso alimenta al siguiente."},{"q":"La ventaja principal es","options":["Más control y mejor calidad","Menos texto","Más emojis"],"answer":0,"explain":"Controlas la dirección paso a paso."}]}$j$, 15, false, 5),
('prompting', 3, 'Errores clásicos', '🚫', $t$Los cinco errores más comunes:

1. Pedir algo vago y culpar a la IA.
2. No decir el formato de salida.
3. Aceptar el primer borrador sin iterar.
4. No verificar datos, fechas ni cifras.
5. Pedir 10 cosas distintas en un solo mensaje.

Arregla estos cinco y tus resultados cambian de nivel.$t$, $j${"questions":[{"q":"Un error clásico es","options":["No decir el formato de salida","Escribir en español","Usar listas"],"answer":0,"explain":"Sin formato definido el resultado es impredecible."},{"q":"Los datos y cifras que da la IA","options":["Se verifican siempre","Son siempre correctos","No importan"],"answer":0,"explain":"Verifica siempre lo importante."}]}$j$, 15, false, 6),
('dev', 1, 'Cómo piensa un programa', '🧠', $t$Programar es explicarle a la máquina una secuencia de pasos sin ambigüedad.

Tres piezas te llevan lejos: variables (guardar datos), condicionales (si pasa esto, haz aquello) y bucles (repetir mientras haga falta).

Con eso puedes describir casi cualquier tarea. La sintaxis se aprende después; la lógica es lo que importa.$t$, $j${"questions":[{"q":"Guardar un dato con nombre es","options":["Una variable","Un bucle","Un servidor"],"answer":0,"explain":"Variable: una caja con nombre."},{"q":"Si pasa esto, haz aquello es","options":["Un condicional","Una variable","Una función"],"answer":0,"explain":"Es un condicional (if)."}]}$j$, 10, true, 1),
('dev', 1, 'Variables y tipos', '📦', $t$Cada dato tiene un tipo: texto (string), número (number), verdadero o falso (boolean), lista (array) y objeto.

En JavaScript: const nombre = "Isa"; let edad = 20; const activo = true; const colores = ["rosa", "morado"];

const es para lo que no cambia; let para lo que sí. Empieza siempre con const.$t$, $j${"questions":[{"q":"true o false es de tipo","options":["boolean","string","array"],"answer":0,"explain":"Boolean: verdadero o falso."},{"q":"Para un valor que no cambia usas","options":["const","let","var"],"answer":0,"explain":"const por defecto."}]}$j$, 10, true, 2),
('dev', 2, 'Funciones', '🔧', $t$Una función es un bloque con nombre que recibe datos y devuelve un resultado. Evita repetir código.

function saludar(nombre) { return "Hola " + nombre; }
saludar("Isa"); // Hola Isa

Regla práctica: si copias y pegas el mismo código dos veces, conviértelo en función.$t$, $j${"questions":[{"q":"Una función sirve para","options":["Reutilizar lógica con nombre","Pintar la pantalla","Guardar en la nube"],"answer":0,"explain":"Agrupa y reutiliza lógica."},{"q":"Lo que la función entrega se llama","options":["Retorno","Bucle","Estilo"],"answer":0,"explain":"El valor de retorno (return)."}]}$j$, 10, true, 3),
('dev', 2, 'HTML, CSS y JavaScript', '🎨', $t$Una web tiene tres capas: HTML es la estructura, CSS es la apariencia y JavaScript el comportamiento.

Piensa en una casa: HTML son los muros, CSS la pintura y la decoración, JavaScript la luz que se enciende cuando entras.

Aprender estas tres capas ya te permite publicar tu primera página.$t$, $j${"questions":[{"q":"La apariencia la define","options":["CSS","HTML","JavaScript"],"answer":0,"explain":"CSS es estilos."},{"q":"El comportamiento interactivo lo da","options":["JavaScript","HTML","CSS"],"answer":0,"explain":"JavaScript reacciona a lo que hace la persona."}]}$j$, 10, true, 4),
('dev', 3, 'Leer un error sin miedo', '🐞', $t$Un error no es un castigo: es una pista con dirección exacta.

Lee siempre tres cosas: el tipo de error, el mensaje y la línea. Ejemplo: TypeError: cannot read properties of undefined significa que usaste algo que no existe todavía.

Método: reproduce el error, lee el mensaje completo, cambia una sola cosa, vuelve a probar.$t$, $j${"questions":[{"q":"Lo primero al ver un error es","options":["Leer el mensaje y la línea","Borrar todo","Reiniciar el PC"],"answer":0,"explain":"El mensaje dice qué y dónde."},{"q":"cannot read properties of undefined suele significar","options":["Usaste algo que aún no existe","Falta internet","El archivo es muy grande"],"answer":0,"explain":"El valor está undefined."}]}$j$, 15, true, 5),
('dev', 3, 'Tu primer proyecto', '🏗️', $t$La mejor forma de aprender es construir algo pequeño y terminarlo.

Proyecto guiado: una página con tu nombre, una foto, tres cosas que sabes hacer y un botón que muestre una frase al hacer clic.

Termina, publica y compártelo. Un proyecto terminado enseña más que diez tutoriales a medias.$t$, $j${"questions":[{"q":"Un buen primer proyecto es","options":["Pequeño y terminable","Una red social completa","Un banco"],"answer":0,"explain":"Pequeño y terminado."},{"q":"Después de terminarlo, lo ideal es","options":["Publicarlo y compartirlo","Guardarlo sin mostrarlo","Borrarlo"],"answer":0,"explain":"Publicar cierra el aprendizaje."}]}$j$, 15, true, 6),
('nocode', 1, 'Qué es no-code', '🧱', $t$No-code es construir software con bloques visuales en vez de escribir código.

Sirve muy bien para: landing pages, formularios, tiendas, paneles internos y automatizaciones. Tiene límite cuando necesitas lógica muy específica o mucha escala.

Estrategia inteligente: valida tu idea con no-code y programa después solo lo que lo justifique.$t$, $j${"questions":[{"q":"No-code es","options":["Construir con bloques visuales","Programar en C","Diseñar en papel"],"answer":0,"explain":"Herramientas visuales, sin escribir código."},{"q":"Su mejor uso es","options":["Validar rápido una idea","Sistemas bancarios críticos","Videojuegos 3D"],"answer":0,"explain":"Ideal para validar rápido."}]}$j$, 10, true, 1),
('nocode', 1, 'Automatizar tareas', '🔁', $t$Toda automatización tiene tres partes: disparador, condición y acción.

Ejemplo: cuando llegue un formulario nuevo (disparador), si el presupuesto es mayor a 100 (condición), mándame un correo y guarda la fila en la hoja de cálculo (acción).

Empieza por la tarea manual que más repites cada semana.$t$, $j${"questions":[{"q":"Las tres partes de una automatización son","options":["Disparador, condición y acción","Inicio, medio y fin","Hola, cuerpo y chao"],"answer":0,"explain":"Trigger, condición y acción."},{"q":"Conviene automatizar primero","options":["Lo que más repites","Lo que nunca haces","Lo más difícil"],"answer":0,"explain":"Ahí está el mayor ahorro."}]}$j$, 10, true, 2),
('nocode', 2, 'Bases de datos sin miedo', '🗃️', $t$Una base de datos es una hoja de cálculo con reglas. Cada tabla guarda un tipo de cosa y cada fila una cosa concreta.

Claves: id (identificador único), columnas con tipo definido y relaciones (esta tarea pertenece a esta persona).

Si sabes pensar en tablas, ya puedes diseñar la mitad de una app.$t$, $j${"questions":[{"q":"Una tabla guarda","options":["Un tipo de cosa","Todo mezclado","Solo texto"],"answer":0,"explain":"Una tabla por entidad."},{"q":"El id sirve para","options":["Identificar cada fila de forma única","Ordenar alfabéticamente","Poner color"],"answer":0,"explain":"Identificador único."}]}$j$, 10, true, 3),
('nocode', 2, 'Integrar IA en tu flujo', '🤝', $t$La IA es un paso más dentro de tu automatización: recibe texto, lo transforma y devuelve texto listo para usar.

Casos que funcionan: clasificar mensajes por urgencia, resumir comentarios, redactar respuestas, extraer datos de un texto libre.

Siempre define el formato de salida para que el siguiente paso pueda usarlo sin arreglos.$t$, $j${"questions":[{"q":"Dentro de una automatización, la IA es","options":["Un paso que transforma datos","El servidor","La base de datos"],"answer":0,"explain":"Un paso de transformación."},{"q":"Para que el siguiente paso funcione debes","options":["Definir el formato de salida","Escribir más largo","Usar mayúsculas"],"answer":0,"explain":"Formato claro y predecible."}]}$j$, 10, true, 4),
('nocode', 3, 'Publicar y medir', '📈', $t$Publicar no es el final: sin medir no sabes si funciona.

Mide siempre tres cosas: cuántas personas llegan, cuántas hacen la acción clave y cuántas vuelven.

Si no vuelven, el problema es el producto. Si no llegan, el problema es la difusión. Cada número te dice dónde trabajar.$t$, $j${"questions":[{"q":"Si la gente llega pero no vuelve, el problema está en","options":["El producto","La publicidad","El dominio"],"answer":0,"explain":"La retención habla del producto."},{"q":"Las tres métricas base son","options":["Llegan, actúan y vuelven","Likes, colores y fuentes","Horas, días y meses"],"answer":0,"explain":"Adquisición, activación y retención."}]}$j$, 15, true, 5),
('nocode', 3, 'De idea a producto en 7 días', '🏁', $t$Plan real de una semana:

Día 1: define el problema y para quién.
Día 2: escribe la promesa en una frase.
Día 3: arma la landing.
Día 4: conecta el formulario y la automatización.
Día 5: muéstralo a 10 personas.
Día 6: corrige lo que confundió a la mayoría.
Día 7: publica y mide.

Rápido, pequeño y real le gana a perfecto y eterno.$t$, $j${"questions":[{"q":"El día 5 del plan sirve para","options":["Mostrarlo a personas reales","Cambiar colores","Descansar"],"answer":0,"explain":"Feedback real temprano."},{"q":"La idea central del plan es","options":["Lanzar algo pequeño y real","Esperar a que sea perfecto","Programar todo a mano"],"answer":0,"explain":"Pequeño, real y medible."}]}$j$, 15, true, 6);