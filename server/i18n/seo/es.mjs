/**
 * Spanish (neutral international) SEO content for the Christmas Wave 1 routes.
 * Genuine ES copy — not machine-filler. Honesty notes:
 *  - Santa Video: product speaks EN/RO only today. We do NOT promise a Spanish-speaking
 *    Santa or Spanish-language video generation.
 *  - Christmas Messages generator: text options are produced in English or Romanian today.
 *    We do not claim native Spanish message generation.
 *  - Cards: the card maker itself (photo + design + your own text) works fine in Spanish;
 *    we do not claim the built-in message-writing assistant works in Spanish.
 *  - No fake inventory, stock counts, or ratings anywhere.
 */

/** @typedef {{
 *   title: string,
 *   description: string,
 *   h1: string,
 *   lede: string,
 *   h2?: string,
 *   h2Body?: string,
 *   links?: Array<{ href: string, label: string }>,
 *   breadcrumbs?: Array<{ href: string, label: string }>,
 *   geo?: { h2: string, body: string },
 *   sections?: Array<{ h2: string, body: string, linkHref?: string, linkLabel?: string, list?: string[] }>,
 *   faqs?: Array<{ q: string, a: string }>,
 * }} LocalizedSeoPage */

export const LOCALE = "es";

/** @type {Record<string, LocalizedSeoPage>} */
export const CHRISTMAS_SEO_CONTENT = {
  "/christmas": {
    title: "Navidad en TheDigitalGifter | Regalos, Fotos, Papá Noel y más",
    description:
      "Crea regalos de Navidad, retratos con IA, vídeos de Papá Noel, listas de deseos, tarjetas de Navidad y sorpresas de Adviento — experiencias digitales personalizadas de TheDigitalGifter.",
    h1: "Crea algo que recordarán esta Navidad",
    lede:
      "Descubre regalos de Navidad, retratos fotográficos, vídeos de Papá Noel, árboles digitales, calendarios de Adviento, tarjetas de Navidad y mensajes — todo en un mismo lugar en TheDigitalGifter.",
    h2: "Experiencias navideñas",
    h2Body: "Elige un producto navideño de la lista y crea algo personal en pocos minutos.",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
    ],
    links: [
      { href: "/es/christmas/gift-finder", label: "Encuentra el regalo de Navidad perfecto" },
      { href: "/es/christmas/wishlist", label: "Crea una lista de deseos navideña" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas/santa-video", label: "Crea un vídeo personalizado de Papá Noel" },
      { href: "/es/christmas/tree", label: "Construye un árbol de Navidad digital" },
      { href: "/es/christmas/advent", label: "Abre el calendario de Adviento" },
      { href: "/es/christmas/cards", label: "Crea una tarjeta de Navidad" },
      { href: "/es/christmas/messages", label: "Encuentra un mensaje de Navidad" },
    ],
    geo: {
      h2: "¿Qué puedes crear con TheDigitalGifter en Navidad?",
      body:
        "TheDigitalGifter es un espacio de creación navideña. Puedes encontrar ideas de regalos con el buscador de regalos, convertir una foto en un retrato navideño para familia, pareja o mascotas, crear un vídeo personalizado de Papá Noel con el nombre del destinatario, montar una lista de deseos navideña para compartir, diseñar una tarjeta de Navidad con tu foto y tu mensaje, escribir felicitaciones, decorar un árbol de Navidad digital y abrir sorpresas diarias de Adviento. Empieza en un solo lugar y salta a la experiencia que mejor encaje con la persona a la que quieres sorprender.",
    },
    sections: [
      {
        h2: "Encuentra el regalo de Navidad perfecto",
        body:
          "¿No sabes qué comprar? El buscador de regalos de Navidad te pregunta para quién compras, qué le gusta, cómo es su día a día y cuánto quieres gastar. Recibes ideas de regalo con una razón breve por la que encajan — incluso para alguien que parece tenerlo todo. Guarda tus favoritos en una lista de deseos cuando quieras.",
        linkHref: "/es/christmas/gift-finder",
        linkLabel: "Encuentra un regalo de Navidad que de verdad le encantará",
      },
      {
        h2: "Crea fotos navideñas mágicas",
        body:
          "Sube una foto nítida y transfórmala en un retrato navideño festivo. Crea estilos para familias, parejas y mascotas — incluidos caminos dedicados para perros y gatos — y luego descárgalo en privado o llévalo a una tarjeta de Navidad.",
        linkHref: "/es/christmas/photo-generator",
        linkLabel: "Convierte tu foto en magia navideña",
      },
      {
        h2: "Consigue un mensaje personalizado de Papá Noel",
        body:
          "Crea un vídeo navideño personalizado de Papá Noel. Cuéntale el nombre del destinatario y detalles opcionales como la edad, algo que ha hecho bien, una afición o un deseo de Navidad. Revisa el mensaje y luego crea un vídeo que podrás descargar y compartir.",
        linkHref: "/es/christmas/santa-video",
        linkLabel: "Crea un vídeo personalizado de Papá Noel",
      },
      {
        h2: "Crea y comparte una lista de deseos navideña",
        body:
          "Monta una lista de deseos con enlaces a productos o deseos escritos libremente. Comparte un único enlace sencillo con familiares y amigos. Quien la vea puede reservar un regalo para que nadie repita — sin desvelar quién lo compró a la persona de la lista.",
        linkHref: "/es/christmas/wishlist",
        linkLabel: "Crea una lista de deseos navideña",
      },
      {
        h2: "Crea una tarjeta de Navidad personalizada",
        body:
          "Combina una foto, un diseño festivo y un mensaje personal en una tarjeta de Navidad que puedes descargar o compartir digitalmente. Usa tu propia foto o un retrato navideño que ya hayas creado.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Crea una tarjeta de Navidad que querrán conservar",
      },
      {
        h2: "Más experiencias navideñas",
        body:
          "También puedes construir un árbol de Navidad digital lleno de sorpresas, abrir puertas de Adviento durante diciembre y encontrar las palabras adecuadas con el generador de mensajes.",
        list: [
          "Árbol de Navidad digital → /es/christmas/tree",
          "Calendario de Adviento → /es/christmas/advent",
          "Mensajes de Navidad → /es/christmas/messages",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Qué puedo crear para Navidad con TheDigitalGifter?",
        a: "Puedes encontrar ideas de regalos, transformar fotos en retratos navideños para familias, parejas y mascotas, empezar la experiencia de Papá Noel, crear una lista de deseos compartible, diseñar una tarjeta, escribir mensajes, decorar un árbol digital y abrir sorpresas de Adviento. Elige una experiencia en esta página y termina en minutos.",
      },
      {
        q: "¿Puede Papá Noel decir el nombre de mi hijo?",
        a: "Puedes empezar con el nombre en la página de Navidad o en la experiencia de Papá Noel y añadir detalles opcionales. Los vídeos hablados están disponibles hoy en inglés y rumano — otros idiomas llegarán.",
      },
      {
        q: "¿Necesito habilidades de diseño?",
        a: "No. Cada experiencia de Navidad te guía paso a paso — sube una foto, responde unas preguntas o empieza con un nombre — y la página hace el resto.",
      },
      {
        q: "¿Es para regalos digitales, físicos o ambos?",
        a: "Ambos. Usa el Buscador y la lista de deseos para comprar en cualquier sitio, y crea retratos y tarjetas digitales para descargar o compartir al instante.",
      },
      {
        q: "¿Funciona en mi teléfono?",
        a: "Sí — el hub de Navidad y las experiencias de producto están pensados primero para móvil y también funcionan en ordenador.",
      },
      {
        q: "¿La foto de mi familia es privada?",
        a: "Las subidas se usan para crear tu retrato o tarjeta. Las experiencias infantiles son privacy-first y esperan un padre o tutor. Cuando el resultado está listo, lo descargas en privado — no publicamos tus fotos.",
      },
      {
        q: "¿Cuánto tarda crear algo?",
        a: "La mayoría de experiencias tardan unos minutos. El Buscador y los mensajes son casi instantáneos. Retratos, tarjetas y Papá Noel te guían paso a paso; las creaciones de pago continúan después del checkout.",
      },
      {
        q: "¿Necesito una cuenta para empezar?",
        a: "Puedes explorar y empezar de inmediato. Algunas experiencias piden un email al unirte o en el pago para guardar el progreso, recibir el resultado o unirte al Christmas Club.",
      },
    ],
  },

  "/christmas/gift-finder": {
    title: "Buscador de Regalos de Navidad | Encuentra el Regalo Perfecto | TheDigitalGifter",
    description:
      "Encuentra ideas de regalos de Navidad pensadas según para quién compras, sus intereses, su personalidad y tu presupuesto.",
    h1: "Encuentra un regalo de Navidad que de verdad le encantará",
    lede:
      "Responde unas preguntas sobre para quién compras y recibe ideas de regalo navideño personalizadas según intereses, personalidad y presupuesto.",
    h2: "Herramientas navideñas relacionadas",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/gift-finder", label: "Buscador de regalos" },
    ],
    links: [
      { href: "/es/christmas/wishlist", label: "Crea una lista de deseos navideña" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas" },
      { href: "/es/christmas/tree", label: "Árbol de Navidad digital" },
      { href: "/es/christmas", label: "Todas las experiencias navideñas" },
    ],
    geo: {
      h2: "¿Qué es un buscador de regalos de Navidad?",
      body:
        "Un buscador de regalos de Navidad es una herramienta guiada que recomienda ideas de regalo según para quién compras, sus intereses y personalidad, y tu presupuesto. En TheDigitalGifter respondes un breve cuestionario y recibes ideas seleccionadas con una razón clara de por qué encajan — luego puedes ajustar las respuestas o guardar ideas en una lista de deseos.",
    },
    sections: [
      {
        h2: "Cómo funciona el buscador de regalos de Navidad",
        body:
          "Elige al destinatario, cuéntanos sus intereses y su personalidad, fija un presupuesto y, si quieres, añade un detalle personal. El buscador te devuelve ideas de regalo ordenadas con explicaciones breves. Puedes ajustar respuestas, empezar de nuevo o guardar ideas en tu lista de deseos navideña.",
        list: [
          "Para quién compras",
          "Intereses y personalidad",
          "Rango de presupuesto",
          "Ideas de regalo personalizadas con sus razones",
        ],
      },
      {
        h2: "Encuentra regalos según el destinatario",
        body:
          "El buscador de regalos cubre las relaciones habituales en las compras navideñas para que las recomendaciones sean acertadas. Úsalo para mamá, papá, esposa, esposo, novia, novio, hijos, adolescentes, abuelos, amigos, compañeros de trabajo y más. Las páginas específicas por destinatario aún no están disponibles — inicia el buscador y elige allí al destinatario.",
        list: [
          "Mamá",
          "Papá",
          "Esposa",
          "Esposo",
          "Novia",
          "Novio",
          "Hijos",
          "Adolescentes",
          "Abuelos",
          "Amigos",
          "Compañeros de trabajo",
        ],
      },
      {
        h2: "Encuentra regalos de Navidad según tu presupuesto",
        body:
          "Elige un rango de gasto, por ejemplo menos de 25 €, 25–50 €, 50–100 €, 100–200 €, más de 200 €, o sin presupuesto fijo. Las recomendaciones son ideas de regalo con rangos de precio orientativos — no inventario en tiempo real de ninguna tienda ni existencias garantizadas.",
      },
      {
        h2: "Regalos para quien lo tiene todo",
        body:
          "Cuando alguien ya tiene «de todo», los regalos navideños útiles suelen inclinarse hacia experiencias, recuerdos personalizados, mejoras para una afición, momentos con significado o artículos prácticos de gama alta. Elegir la personalidad «Lo tiene todo» orienta al buscador hacia esas direcciones en lugar de sugerencias genéricas.",
      },
      {
        h2: "Guarda ideas en tu lista de deseos",
        body:
          "¿Te gusta una idea? Guárdala en tu lista de deseos navideña y comparte una única lista con la familia para que las compras queden coordinadas.",
        linkHref: "/es/christmas/wishlist",
        linkLabel: "Abre el creador de listas de deseos navideñas",
      },
    ],
    faqs: [
      {
        q: "¿Cómo funciona el buscador de regalos de Navidad?",
        a: "Respondes unas preguntas rápidas sobre para quién compras, sus intereses, su personalidad y tu presupuesto. Luego ves ideas de regalo seleccionadas con una razón clara por la que encajan.",
      },
      {
        q: "¿Puedo buscar por presupuesto?",
        a: "Sí. Los rangos de presupuesto son un paso clave del buscador.",
      },
      {
        q: "¿Puedo encontrar regalos para quien ya lo tiene todo?",
        a: "Sí. Entre las opciones de personalidad está «Lo tiene todo», que orienta las ideas hacia experiencias, personalización y recuerdos con significado.",
      },
      {
        q: "¿Puedo usarlo para niños o adolescentes?",
        a: "Sí. Elige Niño/a o Adolescente (o Hija/Hijo con un rango de edad) para que las ideas sean apropiadas para su edad.",
      },
      {
        q: "¿Puedo guardar ideas en mi lista de deseos?",
        a: "Sí. Usa Guardar en la lista de deseos sobre una idea para añadirla a /es/christmas/wishlist.",
      },
      {
        q: "¿Las recomendaciones están personalizadas?",
        a: "Sí. Las recomendaciones tienen en cuenta el destinatario, la edad, los intereses, la personalidad, el presupuesto y un detalle personal opcional.",
      },
      {
        q: "¿Muestra productos reales de tiendas?",
        a: "Hoy el buscador muestra ideas de regalo seleccionadas con rangos de precio orientativos. Los precios en tiempo real, la disponibilidad o los catálogos de tiendas aún no están conectados — no inventamos existencias exactas ni precios de comercios.",
      },
    ],
  },

  "/christmas/wishlist": {
    title: "Creador de Listas de Deseos de Navidad | Crea y Comparte tu Lista",
    description:
      "Crea una lista de deseos navideña, añade regalos de cualquier tienda y comparte un único enlace con familiares y amigos.",
    h1: "Crea una lista de deseos navideña y comparte un único enlace",
    lede:
      "Monta una lista de deseos navideña en pocos minutos. Añade regalos de cualquier tienda o escribe tus propios deseos, y envía un único enlace a familiares y amigos.",
    h2: "Cómo funciona",
    h2Body: "Crea tu lista, añade deseos, comparte un enlace y deja que coordinen los regalos sin arruinar la sorpresa.",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/wishlist", label: "Lista de deseos" },
    ],
    links: [
      { href: "/es/christmas/gift-finder", label: "Prueba el buscador de regalos de Navidad" },
      { href: "/es/christmas/tree", label: "Pon regalos bajo un árbol de Navidad digital" },
      { href: "/es/christmas/photo-generator", label: "Añade un retrato navideño" },
      { href: "/es/christmas", label: "Volver a Navidad" },
    ],
    geo: {
      h2: "¿Qué es una lista de deseos de Navidad online?",
      body:
        "Una lista de deseos de Navidad online es una lista de regalos o experiencias que a alguien le gustaría recibir, lista para compartir. En TheDigitalGifter creas una lista, añades deseos a partir de enlaces de productos o texto libre, compartes un único enlace con familiares y amigos, y dejas que reserven regalos para que las compras queden coordinadas sin arruinar la sorpresa.",
    },
    sections: [
      {
        h2: "Crea una lista de deseos de Navidad online",
        body:
          "Ponle nombre a tu lista, añade deseos y ten cada idea navideña en un solo lugar en lugar de repartida en distintos chats. Puedes empezar rápido y seguir editando cuando quieras.",
      },
      {
        h2: "Añade cualquier cosa que desees",
        body:
          "Pega la URL de un producto de casi cualquier tienda, escribe un deseo manualmente, añade notas e incluye experiencias o ideas hechas a mano. Si un enlace no se puede leer automáticamente, aún puedes guardar el deseo escribiéndolo tú mismo.",
      },
      {
        h2: "Comparte un único enlace sencillo",
        body:
          "Activa la opción de compartir y envía un único enlace de tu lista por copiar y pegar, WhatsApp, correo electrónico o el panel de compartir de tu dispositivo. Las listas compartidas son accesibles para quien tenga el enlace y no están pensadas para aparecer en buscadores.",
      },
      {
        h2: "Evita regalos de Navidad repetidos",
        body:
          "Quien vea la lista puede pulsar «Yo lo compro» para reservar un regalo. Las reservas se mantienen anónimas para el dueño de la lista, así que la sorpresa se mantiene intacta y la familia evita comprar lo mismo dos veces.",
      },
      {
        h2: "Listas de deseos navideñas para niños y familias",
        body:
          "Crea una lista para ti, para tu hijo o para otra persona, y compártela con abuelos y amigos. Combínala con el buscador de regalos cuando no sepas qué pedir.",
        linkHref: "/es/christmas/gift-finder",
        linkLabel: "Prueba el buscador de regalos de Navidad",
      },
    ],
    faqs: [
      {
        q: "¿Cómo creo una lista de deseos de Navidad?",
        a: "Abre la página de la lista de deseos navideña, elige un título y crea tu lista. Luego añade deseos al momento.",
      },
      {
        q: "¿Puedo añadir regalos de cualquier tienda?",
        a: "Sí. Pega el enlace normal de un producto, o añade el regalo manualmente si la página no se puede leer automáticamente.",
      },
      {
        q: "¿Puedo añadir deseos sin un enlace?",
        a: "Sí. Escribe cualquier deseo — experiencias, ideas hechas a mano o un simple «Sorpréndeme».",
      },
      {
        q: "¿Puedo compartir un único enlace de la lista?",
        a: "Sí. Activa la opción de compartir y envía el enlace a familiares y amigos.",
      },
      {
        q: "¿Pueden reservar regalos las personas que la ven?",
        a: "Sí. Quien la vea puede reservar un regalo para que los demás sepan que ya está cubierto.",
      },
      {
        q: "¿Sabré quién compró algo?",
        a: "No. Las reservas se mantienen anónimas para que la sorpresa se conserve.",
      },
      {
        q: "¿Puedo crear una para mi hijo?",
        a: "Sí. Elige para quién es la lista al crearla y luego comparte el enlace con la familia.",
      },
      {
        q: "¿Puedo editarla después de compartirla?",
        a: "Sí. Añade, edita, reordena o elimina deseos cuando quieras. Quien tenga el enlace verá los cambios.",
      },
    ],
  },

  "/christmas/photo-generator": {
    title: "Generador de Fotos Navideñas con IA | Familia, Parejas y Mascotas",
    description:
      "Convierte tu foto favorita en un retrato navideño mágico. Crea fotos festivas para familia, parejas y mascotas en minutos.",
    h1: "Convierte tu foto en magia navideña",
    lede:
      "Sube una foto, elige una escena navideña festiva y crea un retrato navideño personalizado que podrás descargar y compartir en privado.",
    h2: "Estilos de fotos navideñas",
    h2Body: "Crea retratos para familia, parejas, mascotas, perros y gatos desde un único generador de fotos navideñas.",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
    ],
    links: [
      { href: "/es/christmas/family", label: "Retratos navideños en familia" },
      { href: "/es/christmas/couples", label: "Retratos navideños en pareja" },
      { href: "/es/christmas/pets", label: "Retratos navideños de mascotas" },
      { href: "/es/christmas/dogs", label: "Retratos navideños de perros" },
      { href: "/es/christmas/cats", label: "Retratos navideños de gatos" },
      { href: "/es/christmas/cards", label: "Convierte un retrato en tarjeta de Navidad" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas con IA?",
      body:
        "Un generador de fotos navideñas con IA convierte una foto real que subes en un retrato navideño festivo. En TheDigitalGifter eliges quién aparece en la foto, seleccionas un estilo navideño y creas un retrato descargable para familia, parejas, personas o mascotas — privado por defecto.",
    },
    sections: [
      {
        h2: "Convierte tu foto en un retrato navideño",
        body:
          "Sube una foto que te guste, elige el tipo de sujeto, selecciona un estilo navideño y crea un retrato festivo que puedas descargar. El objetivo es una imagen navideña que siga transmitiendo a las personas o mascotas que quieres.",
      },
      {
        h2: "Ejemplos de fotos navideñas",
        body:
          "Los ejemplos de demostración muestran direcciones habituales para los retratos navideños. Son muestras de inspiración, no fotos de clientes.",
        list: [
          "Foto navideña en familia — un retrato de grupo en una escena navideña acogedora",
          "Retrato navideño en pareja — un retrato romántico de dos personas",
          "Retrato navideño de perro — un retrato festivo centrado en un perro",
          "Retrato navideño de gato — un retrato festivo centrado en un gato",
          "Familia + mascota — personas y una mascota compartiendo un mismo encuadre navideño",
        ],
      },
      {
        h2: "Estilos de fotos navideñas",
        body:
          "Los estilos navideños disponibles incluyen Navidad Acogedora, País de las Maravillas Invernal, Navidad de Lujo, Mañana de Navidad, Cabaña Nevada, Navidad Clásica, Navidad Blanca Elegante y Mercado Navideño. Elige el estilo que mejor encaje con el recuerdo que quieres crear.",
      },
      {
        h2: "¿Qué fotos funcionan mejor?",
        body:
          "Usa una foto nítida con las caras visibles (o una mascota bien enfocada), buena iluminación y suficiente nitidez para que todas las personas que quieres incluir sean reconocibles. Evita el desenfoque extremo, recortes agresivos o fotos donde alguien importante quede oculto.",
      },
      {
        h2: "Fotos navideñas para familias, parejas y mascotas",
        body:
          "¿Buscas un punto de partida más concreto? Usa las rutas dedicadas de retratos navideños para familia, pareja, mascotas, perros y gatos — o continúa aquí para el generador de fotos completo.",
        list: [
          "Retratos navideños en familia → /es/christmas/family",
          "Retratos navideños en pareja → /es/christmas/couples",
          "Retratos navideños de mascotas → /es/christmas/pets",
          "Retratos navideños de perros → /es/christmas/dogs",
          "Retratos navideños de gatos → /es/christmas/cats",
          "Convierte un retrato en tarjeta de Navidad → /es/christmas/cards",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Cómo funciona el generador de fotos navideñas?",
        a: "Sube una foto, elige quién aparece en ella, selecciona un estilo navideño y crea tu retrato después de completar la compra cuando el flujo del producto lo requiera.",
      },
      {
        q: "¿Qué foto debo subir?",
        a: "Una foto nítida con las caras visibles o una mascota bien enfocada funciona mejor. Una buena iluminación ayuda. Evita el desenfoque extremo.",
      },
      {
        q: "¿Puedo crear una foto navideña en familia?",
        a: "Sí. Elige familia como sujeto, o empieza desde la ruta de familia.",
      },
      {
        q: "¿Puedo crear un retrato navideño de mi perro o mi gato?",
        a: "Sí. Las mascotas están disponibles como sujeto, con rutas dedicadas para perros y gatos para empezar de forma más clara.",
      },
      {
        q: "¿Pueden aparecer varias personas?",
        a: "Sí, en los flujos de familia y pareja. Sube una foto que incluya a todas las personas que deben aparecer.",
      },
      {
        q: "¿Puedo probar distintos estilos?",
        a: "Sí. Elige entre los estilos navideños disponibles indicados en la página antes de crear tu retrato.",
      },
      {
        q: "¿Puedo descargar el resultado?",
        a: "Sí. Cuando tu retrato esté listo, descárgalo desde la pantalla de resultado.",
      },
      {
        q: "¿Qué pasa con la foto que subo?",
        a: "Las fotos que subes y los resultados son privados por defecto. No hay una galería pública. El acceso se hace a través de tu pedido o resultado.",
      },
    ],
  },

  "/christmas/family": {
    title: "Generador de Fotos Navideñas en Familia | Retratos Familiares de Navidad",
    description:
      "Crea un retrato navideño en familia personalizado a partir de tu foto favorita. Elige una escena navideña festiva y convierte tu foto en un recuerdo.",
    h1: "Convierte tu foto de familia en un retrato navideño mágico",
    lede:
      "Crea un retrato navideño en familia personalizado a partir de tu foto favorita. Elige una escena navideña festiva y convierte tu foto en un recuerdo.",
    h2: "Más retratos navideños",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
      { href: "/es/christmas/family", label: "Familia" },
    ],
    links: [
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas/couples", label: "Retratos navideños en pareja" },
      { href: "/es/christmas/pets", label: "Retratos navideños de mascotas" },
      { href: "/es/christmas/cards", label: "Creador de tarjetas de Navidad" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas en familia?",
      body:
        "Un generador de fotos navideñas en familia convierte una foto de familia que subes en un retrato de grupo navideño y festivo. En TheDigitalGifter subes una foto nítida de tu familia, eliges un estilo navideño pensado para varias personas y creas un retrato descargable — privado por defecto, con opción de continuar hacia una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Crea un retrato navideño en familia",
        body:
          "Esta experiencia está pensada específicamente para familias — no es un estilo genérico para una sola persona. Sube una foto de grupo, elige un ambiente navideño y crea un retrato que busca mantener a todos dentro del encuadre.",
      },
      {
        h2: "Ejemplos de fotos navideñas en familia",
        body:
          "Los ejemplos de demostración muestran direcciones habituales para retratos familiares navideños. Son muestras de inspiración, no fotos de clientes.",
        list: [
          "Padres con hijos en un salón navideño acogedor",
          "Familia de tres o cuatro personas junto a un árbol decorado",
          "Reunión familiar más numerosa en una escena festiva",
          "Retratos multigeneracionales que incluyen a los abuelos",
          "Familia junto a una mascota claramente visible en el mismo encuadre",
        ],
      },
      {
        h2: "Estilos navideños para familias",
        body:
          "Los estilos familiares disponibles hoy incluyen Navidad Familiar Clásica, Chimenea Acogedora, País de las Maravillas Invernal, Navidad Elegante, Mañana de Navidad, Navidad de Lujo, Película de Navidad y Navidad Familiar Vintage.",
      },
      {
        h2: "¿Qué fotos de familia funcionan mejor?",
        body:
          "Usa una foto de grupo nítida donde las caras se vean bien, la iluminación sea adecuada y todas las personas que quieres incluir sean reconocibles. Evita el desenfoque extremo, recortes agresivos o fotos donde alguien importante quede oculto.",
      },
      {
        h2: "Tarjetas de Navidad en familia",
        body:
          "Cuando tu retrato familiar esté listo, puedes continuar hacia el creador de tarjetas de Navidad y terminar con un mensaje.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Convierte tu retrato familiar en una tarjeta de Navidad",
      },
      {
        h2: "Más retratos navideños",
        body:
          "¿Buscas otro tipo de sujeto? Empieza desde el generador de fotos completo o pasa a parejas y mascotas.",
        list: [
          "Generador de fotos navideñas con IA → /es/christmas/photo-generator",
          "Retratos navideños en pareja → /es/christmas/couples",
          "Retratos navideños de mascotas → /es/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Puedo crear un retrato navideño a partir de una foto de familia?",
        a: "Sí. Sube una foto de familia nítida, elige un estilo navideño y crea tu retrato familiar.",
      },
      {
        q: "¿Pueden aparecer varias personas?",
        a: "Sí. Esta ruta está pensada para grupos. Mantén a todos claramente visibles en la foto original.",
      },
      {
        q: "¿Pueden aparecer los abuelos?",
        a: "Sí. Las fotos multigeneracionales — incluyendo abuelos y bebés — son bienvenidas cuando las caras son visibles.",
      },
      {
        q: "¿Puedo incluir a la mascota de la familia?",
        a: "Sí, cuando la mascota se ve claramente en la foto de familia. Para retratos solo de mascota, usa las experiencias de Mascotas, Perros o Gatos.",
      },
      {
        q: "¿Qué fotos funcionan mejor?",
        a: "Fotos nítidas con las caras visibles, buena iluminación y todas las personas que quieres incluir. Evita el desenfoque extremo.",
      },
      {
        q: "¿Puedo probar varios estilos navideños?",
        a: "Sí. Elige entre los estilos familiares navideños de la página, y puedes probar otro estilo después de crear un retrato.",
      },
      {
        q: "¿Puedo descargar el retrato terminado?",
        a: "Sí. Cuando tu retrato esté listo, descárgalo desde la pantalla de resultado.",
      },
      {
        q: "¿Puedo usarlo en una tarjeta de Navidad?",
        a: "Sí. El paso al creador de tarjetas de Navidad está disponible.",
      },
    ],
  },

  "/christmas/couples": {
    title: "Generador de Fotos Navideñas en Pareja | Retratos Románticos de Navidad",
    description:
      "Crea un retrato navideño romántico en pareja a partir de tu foto. Perfecto para vuestra primera Navidad juntos o para un regalo personalizado en pareja.",
    h1: "Crea un retrato navideño mágico en pareja",
    lede:
      "Sube una foto de los dos y crea un retrato navideño romántico en pareja — privado por defecto.",
    h2: "Más retratos navideños",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
      { href: "/es/christmas/couples", label: "Pareja" },
    ],
    links: [
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas/family", label: "Retratos navideños en familia" },
      { href: "/es/christmas/pets", label: "Retratos navideños de mascotas" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas en pareja?",
      body:
        "Un generador de fotos navideñas en pareja convierte una foto de dos personas en un retrato navideño romántico o acogedor. En TheDigitalGifter subes una foto en la que aparecéis los dos, eliges un estilo navideño para pareja y creas un retrato descargable que puedes compartir en privado o usar en una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Crea un retrato navideño juntos",
        body:
          "Esta experiencia es para dos personas — pareja, novios comprometidos, marido y mujer, o novio y novia. Sube una foto en la que ambos se vean claramente, elige un estilo navideño y crea un retrato pensado para los dos.",
      },
      {
        h2: "Ideas de fotos navideñas en pareja",
        body:
          "Casos de uso habituales para este retrato — como inspiración, no modos de producto distintos:",
        list: [
          "Primera Navidad juntos",
          "Retrato navideño de pareja comprometida",
          "Retrato navideño de marido y mujer",
          "Foto navideña de novio y novia",
          "Sorpresa navideña a distancia para compartir digitalmente",
          "Foto navideña en pareja para una tarjeta",
        ],
      },
      {
        h2: "Estilos navideños románticos",
        body:
          "Los estilos de pareja disponibles hoy incluyen Nevada Romántica, Chimenea Acogedora, Película de Navidad, Navidad Elegante, Ciudad Invernal, Mercado Navideño, Retrato Clásico y Navidad Vintage.",
      },
      {
        h2: "¿Qué fotos de pareja funcionan mejor?",
        body:
          "Usa una foto nítida en la que ambas caras se vean bien y nadie quede muy recortado. Una buena iluminación ayuda. Los selfies funcionan bien cuando las dos personas son reconocibles.",
      },
      {
        h2: "Conviértelo en una tarjeta de Navidad",
        body:
          "Después de crear un retrato en pareja, puedes llevarlo al creador de tarjetas de Navidad.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Convierte tu retrato en pareja en una tarjeta de Navidad",
      },
      {
        h2: "Retratos navideños relacionados",
        body: "¿Necesitas un retrato de familia o de mascota?",
        list: [
          "Retratos navideños en familia → /es/christmas/family",
          "Generador de fotos navideñas con IA → /es/christmas/photo-generator",
          "Retratos navideños de mascotas → /es/christmas/pets",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Puedo usar un selfie?",
        a: "Sí, siempre que las dos personas se vean claramente y sean reconocibles en la misma foto.",
      },
      {
        q: "¿Se puede mantener a las dos personas reconocibles?",
        a: "Ese es el objetivo. Empieza con una foto nítida de ambas caras — evita el desenfoque extremo o que una persona quede casi fuera de encuadre.",
      },
      {
        q: "¿Puedo crear un retrato navideño romántico?",
        a: "Sí. Elige estilos románticos o acogedores como Nevada Romántica, Chimenea Acogedora o Navidad Elegante.",
      },
      {
        q: "¿Puedo probar distintos estilos?",
        a: "Sí. Elige entre los estilos de pareja de la página antes de crear tu retrato.",
      },
      {
        q: "¿Puedo usar el resultado como tarjeta de Navidad?",
        a: "Sí. El paso al creador de tarjetas de Navidad está disponible.",
      },
      {
        q: "¿Puedo descargarlo?",
        a: "Sí. Descarga el retrato de pareja terminado desde la pantalla de resultado cuando esté listo.",
      },
      {
        q: "¿Qué tipo de foto debo subir?",
        a: "Una foto nítida que os incluya a los dos. Las caras deben verse bien; funcionan los formatos JPEG, PNG o WebP.",
      },
    ],
  },

  "/christmas/pets": {
    title: "Generador de Fotos Navideñas de Mascotas | Retratos Festivos de Mascotas",
    description:
      "Convierte la foto de tu mascota en un retrato navideño festivo. Perros y gatos bienvenidos — privado por defecto.",
    h1: "Convierte a tu mascota en magia navideña",
    lede:
      "Sube una foto nítida de tu mascota y crea un retrato navideño festivo para perros o gatos.",
    h2: "Retratos navideños por especie",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
      { href: "/es/christmas/pets", label: "Mascotas" },
    ],
    links: [
      { href: "/es/christmas/dogs", label: "Retratos navideños de perros" },
      { href: "/es/christmas/cats", label: "Retratos navideños de gatos" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas de mascotas?",
      body:
        "Un generador de fotos navideñas de mascotas convierte la foto de un perro, un gato u otra mascota en un retrato navideño festivo. En TheDigitalGifter, la página de Mascotas es el punto de partida para retratos navideños de animales, con rutas específicas para perros y gatos, resultados descargables y la opción de continuar hacia una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Convierte a tu mascota en magia navideña",
        body:
          "Sube una foto nítida de tu mascota, elige un estilo navideño para mascotas y crea un retrato festivo del animal que quieres. Este es el punto de partida general para mascotas — no un pack temático específico.",
      },
      {
        h2: "Retratos navideños para perros y gatos",
        body:
          "¿Quieres empezar de forma más concreta con una especie? Usa las rutas específicas de perros o gatos — ayudan a validar la foto y mantienen la experiencia centrada en cada animal.",
        list: [
          "Generador de fotos navideñas de perros → /es/christmas/dogs",
          "Generador de fotos navideñas de gatos → /es/christmas/cats",
        ],
      },
      {
        h2: "Ejemplos de fotos navideñas de mascotas",
        body:
          "Direcciones de demostración para retratos navideños de mascotas. Las muestras son inspiración, no fotos de clientes.",
        list: [
          "Retrato navideño de perro en una escena festiva",
          "Retrato navideño de gato junto a un árbol o una chimenea",
          "Estilos de retrato con jersey navideño o inspirados en Papá Noel",
        ],
      },
      {
        h2: "Estilos navideños para mascotas",
        body:
          "Los estilos de mascotas disponibles hoy incluyen Mascota con Papá Noel, Navidad Acogedora, Polo Norte, Jersey Navideño, Retrato en la Nieve, Tarjeta de Navidad, Navidad Real y Navidad Vintage.",
      },
      {
        h2: "¿Qué fotos de mascotas funcionan mejor?",
        body:
          "Elige una foto nítida donde se vean bien la cara y los ojos de la mascota, con buena iluminación y sin desenfoque extremo. Si quieres que aparezca más de una mascota, asegúrate de que cada animal se vea bien en la foto que subes.",
      },
      {
        h2: "Tarjetas de Navidad con tu mascota",
        body: "Puedes llevar un retrato de mascota terminado al creador de tarjetas de Navidad.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Convierte el retrato de tu mascota en una tarjeta de Navidad",
      },
    ],
    faqs: [
      {
        q: "¿Puedo crear un retrato navideño de mi perro?",
        a: "Sí. Empieza aquí o ve a la página específica de perros para un enfoque centrado en perros.",
      },
      {
        q: "¿Puedo crear uno para mi gato?",
        a: "Sí. Usa esta página de Mascotas o la página específica de gatos.",
      },
      {
        q: "¿Puedo incluir a más de una mascota?",
        a: "Si varias mascotas se ven claramente en una misma foto, puedes probar esa subida. Los resultados son mejores cuando la cara de cada animal se ve bien.",
      },
      {
        q: "¿Puedo aparecer yo con mi mascota?",
        a: "Esta ruta está optimizada para que la mascota sea la protagonista. Para fotos de familia con mascota incluida, la experiencia de Familia suele ser un mejor punto de partida.",
      },
      {
        q: "¿Qué fotos funcionan mejor?",
        a: "Fotos nítidas de mascotas con ojos y cara visibles, buena iluminación y poco desenfoque.",
      },
      {
        q: "¿Puedo descargar la imagen?",
        a: "Sí. Descárgala desde la pantalla de resultado cuando el retrato de tu mascota esté listo.",
      },
      {
        q: "¿Puedo usarla en una tarjeta de Navidad?",
        a: "Sí. El paso al creador de tarjetas de Navidad está disponible.",
      },
    ],
  },

  "/christmas/dogs": {
    title: "Generador de Fotos Navideñas de Perros | Retratos Festivos de Perros",
    description:
      "Crea un retrato navideño mágico de tu perro a partir de una foto nítida. Verificación de especie y privado por defecto.",
    h1: "Crea un retrato navideño mágico de tu perro",
    lede:
      "Sube una foto nítida de tu perro, elige un estilo festivo y crea un retrato navideño de perro.",
    h2: "Retratos de mascotas relacionados",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
      { href: "/es/christmas/pets", label: "Mascotas" },
      { href: "/es/christmas/dogs", label: "Perros" },
    ],
    links: [
      { href: "/es/christmas/cats", label: "Retratos navideños de gatos" },
      { href: "/es/christmas/pets", label: "Todos los retratos navideños de mascotas" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas de perros?",
      body:
        "Un generador de fotos navideñas de perros crea un retrato navideño festivo a partir de una foto de tu perro. En TheDigitalGifter subes una foto nítida de tu perro, eliges un estilo navideño para mascotas y descargas un retrato festivo centrado en el perro — con la opción de continuar hacia una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Crea un retrato navideño de tu perro",
        body:
          "Esta página es específica para perros. Sube una foto de tu perro, elige un estilo navideño y crea un retrato festivo que mantiene al perro como protagonista claro. Si la foto parece de un gato, te guiaremos hacia la experiencia de gatos.",
      },
      {
        h2: "Ejemplos de retratos navideños de perros",
        body:
          "Direcciones de demostración para retratos navideños de perros — muestras de inspiración, no fotos de clientes.",
        list: [
          "Perro junto a un árbol de Navidad decorado",
          "Retrato navideño de perro junto a la chimenea",
          "Retrato navideño de perro en la nieve",
          "Retrato de perro inspirado en Papá Noel o con jersey navideño",
        ],
      },
      {
        h2: "Estilos navideños para perros",
        body:
          "Los retratos de perros usan el conjunto de estilos navideños para mascotas: Mascota con Papá Noel, Navidad Acogedora, Polo Norte, Jersey Navideño, Retrato en la Nieve, Tarjeta de Navidad, Navidad Real y Navidad Vintage.",
      },
      {
        h2: "Cómo elegir una buena foto de tu perro",
        body:
          "Elige una foto donde los ojos y la cara de tu perro se vean bien, la cabeza no esté muy recortada y haya poco desenfoque. Si hay más de un perro, asegúrate de que cada uno que quieras incluir se vea claramente en el encuadre.",
      },
      {
        h2: "Tarjetas de Navidad con tu perro",
        body: "Los retratos de perro terminados pueden continuar hacia el creador de tarjetas de Navidad.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Haz una tarjeta de Navidad con el retrato de tu perro",
      },
      {
        h2: "Retratos navideños de mascotas relacionados",
        body: "¿Buscas otros animales o el punto de partida general de mascotas?",
        list: [
          "Retratos navideños de mascotas → /es/christmas/pets",
          "Generador de fotos navideñas de gatos → /es/christmas/cats",
          "Generador de fotos navideñas con IA → /es/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Puedo crear un retrato navideño de mi perro?",
        a: "Sí. Sube una foto nítida de tu perro en esta página, elige un estilo navideño y crea el retrato.",
      },
      {
        q: "¿Qué pasa si subo una foto de gato por error?",
        a: "Te llegará una sugerencia para cambiar a la experiencia de retratos navideños de gatos.",
      },
      {
        q: "¿Puedo incluir a más de un perro?",
        a: "Sí, si cada perro se ve claramente en la misma foto. Las caras y los ojos deben verse bien.",
      },
      {
        q: "¿Qué fotos de perros funcionan mejor?",
        a: "Cara y ojos nítidos, poco desenfoque, y evitar recortar las orejas o la cabeza.",
      },
      {
        q: "¿Puedo probar distintos estilos navideños para mi perro?",
        a: "Sí. Elige entre los estilos navideños para mascotas indicados en la página.",
      },
      {
        q: "¿Puedo descargar el retrato de mi perro?",
        a: "Sí. Descárgalo desde la pantalla de resultado cuando esté listo.",
      },
      {
        q: "¿Puedo poner a mi perro en una tarjeta de Navidad?",
        a: "Sí. Usa el paso al creador de tarjetas de Navidad después de que tu retrato esté listo.",
      },
    ],
  },

  "/christmas/cats": {
    title: "Generador de Fotos Navideñas de Gatos | Retratos Festivos de Gatos",
    description:
      "Crea un retrato navideño mágico de tu gato a partir de una foto nítida. Verificación de especie y privado por defecto.",
    h1: "Crea un retrato navideño mágico de tu gato",
    lede:
      "Sube una foto nítida de tu gato, elige un estilo festivo y crea un retrato navideño de gato.",
    h2: "Retratos de mascotas relacionados",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos" },
      { href: "/es/christmas/pets", label: "Mascotas" },
      { href: "/es/christmas/cats", label: "Gatos" },
    ],
    links: [
      { href: "/es/christmas/dogs", label: "Retratos navideños de perros" },
      { href: "/es/christmas/pets", label: "Todos los retratos navideños de mascotas" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas con IA" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de fotos navideñas de gatos?",
      body:
        "Un generador de fotos navideñas de gatos crea un retrato navideño festivo a partir de una foto de tu gato. En TheDigitalGifter subes una foto nítida de tu gato, eliges un estilo navideño para mascotas y descargas un retrato festivo centrado en el gato que también puedes usar en una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Crea un retrato navideño mágico de tu gato",
        body:
          "Esta página es específica para gatos. Sube una foto de tu gato, elige un ambiente navideño y crea un retrato festivo con el gato como protagonista. Las fotos de perro se redirigen hacia la experiencia de perros.",
      },
      {
        h2: "Ejemplos de retratos navideños de gatos",
        body:
          "Direcciones de demostración con gatos — muestras de inspiración, no fotos de clientes.",
        list: [
          "Gato junto a un árbol de Navidad",
          "Retrato navideño de gato acogedor junto a la chimenea",
          "Retrato navideño de gato en la nieve o con estilo elegante",
          "Estilos de retrato de gato con ambiente real o vintage",
        ],
      },
      {
        h2: "Estilos navideños para gatos",
        body:
          "Los retratos de gatos usan el conjunto de estilos navideños para mascotas: Mascota con Papá Noel, Navidad Acogedora, Polo Norte, Jersey Navideño, Retrato en la Nieve, Tarjeta de Navidad, Navidad Real y Navidad Vintage.",
      },
      {
        h2: "Cómo elegir una buena foto de tu gato",
        body:
          "Elige una foto donde los ojos y la cara de tu gato se vean nítidos y visibles. Evita el desenfoque extremo, sombras fuertes sobre la cara o recortes muy ajustados que corten orejas y bigotes.",
      },
      {
        h2: "Convierte el retrato de tu gato en una tarjeta de Navidad",
        body: "Después de crear un retrato navideño de tu gato, puedes continuar hacia el creador de tarjetas de Navidad.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Haz una tarjeta de Navidad con el retrato de tu gato",
      },
      {
        h2: "Retratos navideños de mascotas relacionados",
        body: "¿Necesitas perros o el punto de partida general de mascotas?",
        list: [
          "Retratos navideños de mascotas → /es/christmas/pets",
          "Generador de fotos navideñas de perros → /es/christmas/dogs",
          "Generador de fotos navideñas con IA → /es/christmas/photo-generator",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Puedo crear un retrato navideño de mi gato?",
        a: "Sí. Sube una foto nítida de tu gato aquí, elige un estilo navideño y crea el retrato.",
      },
      {
        q: "¿Qué pasa si subo una foto de un perro?",
        a: "Te llegará una sugerencia para cambiar a la página de retratos navideños de perros.",
      },
      {
        q: "¿Importa el detalle de los bigotes y la cara?",
        a: "Sí. Un buen detalle en cara y ojos suele dar un retrato navideño de gato más logrado.",
      },
      {
        q: "¿Puedo probar estilos elegantes o acogedores para mi gato?",
        a: "Sí. Los estilos incluyen Navidad Acogedora, Navidad Real, Navidad Vintage, Retrato en la Nieve y más.",
      },
      {
        q: "¿Puedo descargar el retrato de mi gato?",
        a: "Sí. Descárgalo desde la pantalla de resultado cuando esté listo.",
      },
      {
        q: "¿Puedo usar el retrato de mi gato en una tarjeta de Navidad?",
        a: "Sí. El paso al creador de tarjetas está disponible después de crear el retrato.",
      },
      {
        q: "¿Es distinto de la página de Mascotas?",
        a: "Sí. Mascotas es el punto de partida general para animales; esta página es específica para gatos.",
      },
    ],
  },

  "/christmas/santa-video": {
    title: "Vídeo Personalizado de Papá Noel | Papá Noel Dice el Nombre de tu Hijo",
    description:
      "Crea un vídeo navideño personalizado de Papá Noel que puede incluir el nombre del destinatario y otros detalles personales admitidos.",
    h1: "Crea un vídeo personalizado de Papá Noel",
    lede:
      "Crea un vídeo navideño personalizado de Papá Noel que puede incluir el nombre del destinatario y otros detalles personales admitidos.",
    h2: "Cómo funcionan los vídeos de Papá Noel",
    h2Body: "Cuéntale a Papá Noel para quién es, añade unos detalles y crea un vídeo navideño personalizado.",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/santa-video", label: "Vídeo de Papá Noel" },
    ],
    links: [
      { href: "/es/christmas/family", label: "Retratos navideños en familia" },
      { href: "/es/christmas/cards", label: "Creador de tarjetas de Navidad" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un vídeo personalizado de Papá Noel?",
      body:
        "Un vídeo personalizado de Papá Noel es un vídeo con un mensaje navideño de Papá Noel que puede incluir el nombre del destinatario y otros detalles que aportes. En TheDigitalGifter respondes un formulario guiado breve, revisas el mensaje y luego creas un vídeo que puedes descargar y compartir. El vídeo se genera en inglés o rumano; no ofrecemos hoy una voz de Papá Noel en español.",
    },
    sections: [
      {
        h2: "Un mensaje personalizado de Papá Noel",
        body:
          "Crea un vídeo navideño de Papá Noel para un niño o niña, hermanos, la familia o alguien especial. Papá Noel puede decir su nombre e incluir detalles opcionales que compartas — luego descargas o compartes el vídeo terminado.",
      },
      {
        h2: "¿Qué puede mencionar Papá Noel?",
        body:
          "Puedes personalizar con el nombre del destinatario, la edad opcional, algo que ha hecho bien este año, un deseo de Navidad, un detalle extra (como una mascota o una afición) y el idioma de Papá Noel. Los idiomas admitidos hoy son inglés y rumano.",
        list: [
          "Nombre del destinatario",
          "Edad opcional",
          "Algo que ha hecho bien",
          "Deseo de Navidad",
          "Detalle personal adicional",
          "Idioma: inglés o rumano",
        ],
      },
      {
        h2: "Ejemplos de vídeos personalizados de Papá Noel",
        body:
          "Los ejemplos de demostración muestran cómo puede sentirse un mensaje personalizado de Papá Noel. Son demostraciones del producto para inspirarte, no testimonios de clientes.",
      },
      {
        h2: "Cómo funciona",
        body:
          "Cuéntale a Papá Noel para quién es el mensaje, añade los detalles que quieras que mencione, revisa la vista previa del mensaje, crea el vídeo y luego descárgalo o compártelo cuando esté listo.",
        list: [
          "Cuéntale a Papá Noel sobre esa persona",
          "Revisa el mensaje",
          "Crea el vídeo",
          "Descarga o comparte",
        ],
      },
      {
        h2: "Más magia navideña",
        body:
          "Después de Papá Noel, muchas familias también crean un retrato o una tarjeta de Navidad para la misma persona.",
        linkHref: "/es/christmas",
        linkLabel: "Volver a Navidad en TheDigitalGifter",
      },
    ],
    faqs: [
      {
        q: "¿Puede Papá Noel decir el nombre de mi hijo?",
        a: "Sí. El nombre del destinatario es un campo principal de personalización y Papá Noel lo dice en el vídeo.",
      },
      {
        q: "¿Qué puedo personalizar?",
        a: "Nombre, edad opcional, algo que ha hecho bien, deseo de Navidad, un detalle extra e idioma (inglés o rumano).",
      },
      {
        q: "¿Puede Papá Noel mencionar un regalo de Navidad?",
        a: "Sí — puedes incluir un deseo de Navidad, y Papá Noel puede mencionarlo si lo indicas.",
      },
      {
        q: "¿Puedo hacer un vídeo para varios hermanos?",
        a: "Sí. Elige la opción de hermanos e incluye sus nombres en el paso correspondiente. Un flujo dedicado para varios niños podría llegar más adelante.",
      },
      {
        q: "¿En español puede hablar Papá Noel?",
        a: "Todavía no. Hoy Papá Noel habla en inglés o rumano en el vídeo, aunque toda la página y el formulario están en español. No prometemos un vídeo con voz en español por el momento.",
      },
      {
        q: "¿Puedo previsualizar el mensaje antes?",
        a: "Sí. Puedes revisar el mensaje antes de crear el vídeo.",
      },
      {
        q: "¿Puedo descargar o compartir el vídeo?",
        a: "Sí. Cuando el vídeo esté listo, puedes descargar el MP4 y compartirlo.",
      },
    ],
  },

  "/christmas/tree": {
    title: "Árbol de Navidad Digital | Regalos, Mensajes y Recuerdos",
    description:
      "Construye un árbol de Navidad digital lleno de regalos, mensajes y recuerdos que puedes decorar y compartir de forma segura.",
    h1: "Construye un árbol de Navidad lleno de sorpresas",
    lede:
      "Crea, decora y comparte un árbol de Navidad digital personalizado con regalos y mensajes debajo.",
    h2: "Combínalo con regalos de Navidad",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/tree", label: "Árbol digital" },
    ],
    links: [
      { href: "/es/christmas/wishlist", label: "Creador de listas de deseos navideñas" },
      { href: "/es/christmas/gift-finder", label: "Buscador de regalos de Navidad" },
      { href: "/es/christmas/messages", label: "Generador de mensajes de Navidad" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un árbol de Navidad digital?",
      body:
        "Un árbol de Navidad digital es un árbol de Navidad interactivo en línea que puedes personalizar y compartir. En TheDigitalGifter eliges un estilo de árbol, añades decoraciones, colocas cajas de regalo con mensajes personales debajo y compartes un enlace privado para que alguien especial pueda abrir los regalos en su pantalla — sin convertir la página compartida en un resultado público de búsqueda.",
    },
    sections: [
      {
        h2: "Construye un árbol de Navidad digital",
        body:
          "Crea un árbol de Navidad interactivo y gratuito en tu navegador. Personaliza el estilo (Clásico, Nevado, Dorado, Acogedor, Minimalista o Mágico), las luces, la nieve, la estrella y los adornos, y luego coloca cajas de regalo debajo.",
      },
      {
        h2: "¿Qué puedes poner bajo tu árbol?",
        body:
          "Hoy puedes añadir cajas de regalo que contienen mensajes personales de Navidad. Cada regalo puede usar un estilo de caja festivo como rojo, dorado, verde, azul o nieve. Otros tipos de regalo podrían llegar más adelante — el creador actual se centra en regalos con mensaje.",
        list: [
          "Mensajes personales de Navidad dentro de cajas de regalo",
          "Estilos de caja festivos (rojo, dorado, verde, azul, nieve)",
        ],
      },
      {
        h2: "Comparte tu árbol de Navidad",
        body:
          "Cuando estés listo, activa la opción de compartir y envía un enlace. Quien lo reciba podrá abrir el árbol, ver las decoraciones y desenvolver los regalos. Los enlaces de árboles compartidos están pensados para personas de confianza y no se indexan para buscadores.",
      },
      {
        h2: "Un regalo pensado para abrirse",
        body:
          "Quien reciba el enlace puede pulsar sobre los regalos bajo el árbol para descubrir los mensajes que dejaste — un momento digital pensado para sentirse como algo colocado especialmente para esa persona.",
      },
      {
        h2: "Cómo funciona",
        body: "Un camino sencillo desde un árbol en blanco hasta una sorpresa navideña compartible.",
        list: [
          "Crea y personaliza tu árbol de Navidad digital",
          "Añade cajas de regalo con mensajes",
          "Activa la opción de compartir y envía el enlace",
          "Abren los regalos bajo el árbol",
        ],
      },
      {
        h2: "Más magia navideña",
        body:
          "Combina tu árbol con otras creaciones navideñas cuando quieras algo extra dentro del ambiente festivo.",
        list: [
          "Inicio de Navidad → /es/christmas",
          "Vídeo personalizado de Papá Noel → /es/christmas/santa-video",
          "Calendario de Adviento online → /es/christmas/advent",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Qué es un árbol de Navidad digital?",
        a: "Un árbol de Navidad interactivo en línea que personalizas, llenas con regalos-mensaje y compartes para que alguien pueda abrirlos en su dispositivo.",
      },
      {
        q: "¿Qué puedo añadir?",
        a: "Hoy puedes añadir cajas de regalo con mensajes personales de Navidad y elegir estilos de caja festivos.",
      },
      {
        q: "¿Puedo compartirlo con alguien?",
        a: "Sí. Activa la opción de compartir y envía el enlace. Trátalo como un enlace de regalo personal.",
      },
      {
        q: "¿Pueden abrir los regalos quienes lo reciben?",
        a: "Sí. Pueden pulsar sobre los regalos bajo el árbol para descubrir los mensajes que añadiste.",
      },
      {
        q: "¿Puedo añadir un vídeo de Papá Noel o una foto navideña bajo el árbol?",
        a: "No como tipo de regalo específico en el creador de árboles actual. Puedes crear esas experiencias por separado y mencionarlas dentro de un regalo con mensaje.",
      },
      {
        q: "¿Necesito una cuenta?",
        a: "Puedes empezar a crear un árbol sin una configuración compleja — la propiedad se gestiona con la sesión de creación para que puedas seguir editando.",
      },
      {
        q: "¿El árbol compartido es público?",
        a: "Los árboles compartidos son accesibles para quien tenga el enlace, pero las páginas compartidas no se indexan y no están pensadas para buscadores.",
      },
    ],
  },

  "/christmas/advent": {
    title: "Calendario de Adviento de Navidad Online | Una Sorpresa Cada Día",
    description:
      "Abre una nueva sorpresa navideña digital cada día del 1 al 24 de diciembre.",
    h1: "Un poco de magia navideña cada día",
    lede:
      "Abre una nueva sorpresa navideña digital cada día del 1 al 24 de diciembre.",
    h2: "Más magia navideña",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/advent", label: "Calendario de Adviento" },
    ],
    links: [
      { href: "/es/christmas/santa-video", label: "Vídeo personalizado de Papá Noel" },
      { href: "/es/christmas/cards", label: "Creador de tarjetas de Navidad" },
      { href: "/es/christmas/wishlist", label: "Lista de deseos navideña" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un calendario de Adviento online?",
      body:
        "Un calendario de Adviento online es la versión digital del calendario de Adviento tradicional: cada día de diciembre se abre una nueva puerta hasta llegar a Navidad. En TheDigitalGifter abres la puerta de hoy en un calendario del 1 al 24 (hora de Europa/Bucarest). Las puertas de días pasados no se pueden abrir después de que pase el día, y algunos premios pueden requerir iniciar sesión cuando el sorteo está activo.",
    },
    sections: [
      {
        h2: "Un poco de magia navideña cada día",
        body:
          "El calendario de Adviento es una cuenta atrás con veinticuatro puertas. Cada día de diciembre tiene su propia puerta — un pequeño ritual de descubrir algo nuevo a medida que se acerca la Navidad.",
      },
      {
        h2: "Abre una nueva puerta cada día",
        body:
          "Las puertas siguen el día del calendario en la zona horaria de Europa/Bucarest. Solo la puerta de hoy está disponible para abrir. Las puertas futuras permanecen cerradas. Los días que se te pasen no se pueden recuperar después.",
      },
      {
        h2: "¿Qué puede haber detrás de las puertas?",
        body:
          "Los premios de cada puerta son sorpresas navideñas configuradas para la temporada — como un reclamo cuando los premios en producción están activos. La disponibilidad puede depender de la configuración de la temporada y de si has iniciado sesión.",
      },
      {
        h2: "Antes del 1 de diciembre",
        body:
          "Antes de que empiece la ventana de Adviento, las puertas se muestran como próximamente. Vuelve cuando empiece diciembre para abrir el primer día.",
      },
      {
        h2: "Cómo funciona el calendario de Adviento",
        body: "Pasos sencillos para la experiencia digital de Adviento.",
        list: [
          "Abre la página del calendario de Adviento",
          "Busca la puerta de hoy (1–24 en diciembre)",
          "Ábrela cuando esté disponible",
          "Inicia sesión si un premio lo requiere",
        ],
      },
      {
        h2: "Más magia navideña",
        body: "Continúa la temporada con un árbol digital o el inicio de Navidad.",
        list: [
          "Árbol de Navidad digital → /es/christmas/tree",
          "Inicio de Navidad → /es/christmas",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Cuándo empieza el calendario de Adviento?",
        a: "Las puertas corresponden a los días de diciembre del 1 al 24. Antes del 1 de diciembre, las puertas aparecen como próximamente.",
      },
      {
        q: "¿Cuándo se abre cada puerta?",
        a: "Cada puerta se abre en su día correspondiente según la hora de Europa/Bucarest.",
      },
      {
        q: "¿Puedo abrir puertas anteriores?",
        a: "No. Los días que se pasan quedan cerrados — solo la puerta de hoy está disponible.",
      },
      {
        q: "¿El calendario es gratis?",
        a: "Explorar la experiencia del calendario es gratis. Algunos premios pueden requerir una cuenta cuando los sorteos están activos en la temporada.",
      },
      {
        q: "¿Qué puedo encontrar detrás de una puerta?",
        a: "Sorpresas navideñas de temporada configuradas para ese día cuando los premios están activos — no una garantía de premios en efectivo o crédito de tienda todos los días.",
      },
      {
        q: "¿Necesito una cuenta?",
        a: "Puedes ver el calendario sin ella. Reclamar ciertos premios de las puertas puede requerir iniciar sesión.",
      },
      {
        q: "¿Puedo usarlo en el móvil?",
        a: "Sí. El calendario de Adviento está diseñado para funcionar tanto en el móvil como en el ordenador.",
      },
      {
        q: "¿Puedo compartirlo?",
        a: "Puedes compartir el enlace de la página del calendario de Adviento para que otros abran sus propias puertas diarias.",
      },
    ],
  },

  "/christmas/cards": {
    title: "Creador de Tarjetas de Navidad | Tarjetas de Navidad Personalizadas",
    description:
      "Crea una tarjeta de Navidad personalizada que querrán conservar — elige un diseño, añade tu mensaje y comparte o descarga.",
    h1: "Crea una tarjeta de Navidad que querrán conservar",
    lede:
      "Diseña una tarjeta de Navidad personalizada con diseños festivos y tu propio mensaje. Algunos mensajes merecen algo más que un simple texto.",
    h2: "Combínalo con mensajes de Navidad",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/cards", label: "Tarjetas" },
    ],
    links: [
      { href: "/es/christmas/messages", label: "Generador de mensajes de Navidad" },
      { href: "/es/christmas/photo-generator", label: "Generador de fotos navideñas" },
      { href: "/es/christmas/family", label: "Retratos navideños en familia" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un creador de tarjetas de Navidad online?",
      body:
        "Un creador de tarjetas de Navidad online te permite hacer una tarjeta personalizada con una foto, un diseño festivo y tu propio mensaje. En TheDigitalGifter puedes subir una foto o usar un retrato navideño, elegir un estilo, escribir tu mensaje en español y luego descargar un PNG o compartir la tarjeta digitalmente.",
    },
    sections: [
      {
        h2: "Crea una tarjeta de Navidad personalizada",
        body:
          "Elige un estilo de tarjeta de Navidad, añade tu foto, escribe un mensaje y crea una tarjeta digital que puedes descargar o compartir. Algunos mensajes merecen algo más que un simple texto — esto es para eso.",
      },
      {
        h2: "Ejemplos de tarjetas de Navidad",
        body:
          "Explora direcciones como tarjetas familiares, de pareja, de mascota, elegantes, divertidas y clásicas. Los ejemplos son inspiración de diseño para los estilos disponibles en el creador.",
        list: ["Familiar", "En pareja", "De mascota", "Elegante", "Divertida", "Clásica"],
      },
      {
        h2: "Usa tu retrato navideño",
        body:
          "Si ya creaste un retrato navideño, puedes llevarlo al creador de tarjetas y terminarlo con un mensaje. El paso desde el generador de fotos navideñas está disponible.",
        linkHref: "/es/christmas/photo-generator",
        linkLabel: "Crea primero un retrato navideño",
      },
      {
        h2: "Mensajes para tarjetas de Navidad",
        body:
          "Escribe tus propias palabras en español. Si quieres inspiración adicional, el generador de mensajes de Navidad ofrece hoy sus opciones de texto en inglés o rumano, así que tradúcelas o úsalas solo como punto de partida antes de escribir tu propio mensaje.",
        linkHref: "/es/christmas/messages",
        linkLabel: "Encuentra un mensaje de Navidad",
      },
      {
        h2: "Cómo hacer una tarjeta de Navidad online",
        body: "Un camino sencillo desde una página en blanco hasta una tarjeta de Navidad compartible.",
        list: [
          "Elige un estilo de tarjeta de Navidad",
          "Sube una foto o usa un retrato navideño",
          "Escribe tu mensaje",
          "Descarga el PNG o compártelo digitalmente",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Puedo subir mi propia foto?",
        a: "Sí. Sube una foto como elemento central de tu tarjeta de Navidad.",
      },
      {
        q: "¿Puedo usar un retrato navideño?",
        a: "Sí. Si creaste un retrato en el generador de fotos navideñas, puedes llevarlo al creador de tarjetas.",
      },
      {
        q: "¿Me ayudáis a escribir el mensaje en español?",
        a: "Puedes escribir tu propio mensaje en español directamente en la tarjeta. La ayuda automática para redactar mensajes funciona hoy en inglés o rumano; para español, escribe tú el texto o adapta una idea propia.",
      },
      {
        q: "¿Puedo hacer una tarjeta familiar?",
        a: "Sí. Los estilos y diseños de fotos pensados para familia forman parte del creador.",
      },
      {
        q: "¿Puedo hacer una tarjeta con mi mascota?",
        a: "Sí. Las fotos de mascotas quedan bien en varios estilos de tarjeta de Navidad.",
      },
      {
        q: "¿Puedo descargar la tarjeta?",
        a: "Sí. Descarga un PNG en alta resolución para uso personal.",
      },
      {
        q: "¿Puedo compartirla digitalmente?",
        a: "Sí. Comparte con las opciones de tu dispositivo, WhatsApp, correo electrónico o copiando un enlace donde esté disponible.",
      },
      {
        q: "¿Qué estilos de tarjeta hay disponibles?",
        a: "Los estilos incluyen looks clásicos, elegantes en dorado, acogedores, país de las maravillas invernal, minimalistas, vintage, desenfadados y románticos.",
      },
    ],
  },

  "/christmas/messages": {
    title: "Generador de Mensajes de Navidad | Deseos para Familia y Amigos",
    description:
      "Encuentra el mensaje de Navidad perfecto para familia, amigos y compañeros — y úsalo después en una tarjeta de Navidad personalizada.",
    h1: "Encuentra el mensaje de Navidad perfecto",
    lede:
      "Genera deseos navideños cálidos, divertidos, románticos o profesionales, y luego lleva tu favorito a una tarjeta de Navidad.",
    h2: "Convierte las palabras en una tarjeta",
    breadcrumbs: [
      { href: "/es/christmas", label: "Navidad" },
      { href: "/es/christmas/messages", label: "Mensajes" },
    ],
    links: [
      { href: "/es/christmas/cards", label: "Creador de tarjetas de Navidad" },
      { href: "/es/christmas/wishlist", label: "Lista de deseos navideña" },
      { href: "/es/christmas/tree", label: "Árbol de Navidad digital" },
      { href: "/es/christmas", label: "Inicio de Navidad" },
    ],
    geo: {
      h2: "¿Qué es un generador de mensajes de Navidad?",
      body:
        "Un generador de mensajes de Navidad te ayuda a escribir felicitaciones eligiendo para quién es el mensaje y el tono que quieres — y luego genera opciones de texto editables. En TheDigitalGifter puedes generar mensajes navideños entrañables, divertidos, románticos, cálidos, cortos, profesionales o religiosos en inglés o rumano hoy, copiarlos y adaptarlos a tu idioma, o continuar hacia una tarjeta de Navidad.",
    },
    sections: [
      {
        h2: "Encuentra el mensaje de Navidad perfecto",
        body:
          "Elige un destinatario, un tono, una longitud (corta, media o larga), añade opcionalmente un detalle personal y genera opciones de mensaje que puedes editar y usar.",
      },
      {
        h2: "Mensajes de Navidad por destinatario",
        body:
          "El generador cubre las relaciones navideñas habituales. Inicia la herramienta y elige a quién le escribes — las páginas dedicadas por destinatario aún no están disponibles.",
        list: ["Mamá", "Papá", "Esposa", "Esposo", "Novia", "Novio", "Familia", "Amigo/a", "Compañero/a de trabajo"],
      },
      {
        h2: "Mensajes de Navidad por tono",
        body:
          "Las opciones de tono disponibles hoy incluyen cálido, divertido, romántico, entrañable, corto y sencillo, profesional y religioso.",
      },
      {
        h2: "Ejemplos de mensajes de Navidad",
        body:
          "Direcciones de demostración del tipo de deseos que la herramienta puede ayudarte a redactar — edita cualquier texto para que suene a ti.",
        list: [
          "Nota entrañable para mamá agradeciéndole otro año de cariño discreto",
          "Deseo corto y cálido para un amigo al que no ves lo suficiente",
          "Frase romántica de Navidad para la primera Navidad en pareja",
          "Mensaje ligero y divertido para un compañero de trabajo, sin salirse del tono profesional",
        ],
      },
      {
        h2: "Cómo escribir un mensaje de Navidad con sentido",
        body:
          "Dirígete a la persona por su nombre o su relación contigo, menciona un recuerdo o cualidad compartida cuando encaje, expresa un sentimiento claro, mantén un lenguaje natural y cierra de forma personal. El generador es un punto de partida — tu edición es lo que lo hace real.",
      },
      {
        h2: "Usa tu mensaje en una tarjeta de Navidad",
        body:
          "Cuando encuentres unas palabras que te gusten, continúa hacia el creador de tarjetas de Navidad y combina el mensaje con una foto y un diseño.",
        linkHref: "/es/christmas/cards",
        linkLabel: "Lleva este mensaje de Navidad a una tarjeta",
      },
    ],
    faqs: [
      {
        q: "¿Cómo funciona el generador de mensajes de Navidad?",
        a: "Elige destinatario, tono y longitud, añade opcionalmente un detalle, y luego genera opciones de mensaje que puedes copiar o editar.",
      },
      {
        q: "¿Puedo escribir un mensaje para mi pareja?",
        a: "Sí. Elige novia, novio, pareja, esposa o esposo y un tono romántico o cálido.",
      },
      {
        q: "¿Puede crear mensajes de Navidad divertidos?",
        a: "Sí. Selecciona el tono divertido — mantén un tono profesional cuando escribas a compañeros de trabajo.",
      },
      {
        q: "¿En qué idioma se generan los mensajes?",
        a: "Hoy el generador crea el texto en inglés o rumano. Puedes copiarlo y adaptarlo o traducirlo al español, o usarlo solo como inspiración antes de escribir tu propio mensaje en español.",
      },
      {
        q: "¿Puedo editar los mensajes generados?",
        a: "Sí. Trata el texto generado como un borrador y reescríbelo con libertad antes de enviarlo o ponerlo en una tarjeta.",
      },
      {
        q: "¿Puede crear deseos navideños cortos?",
        a: "Sí. Elige la longitud corta o el tono corto y sencillo.",
      },
      {
        q: "¿Puedo usar un mensaje en una tarjeta de Navidad?",
        a: "Sí. Continúa hacia el creador de tarjetas de Navidad con el paso de traspaso del mensaje.",
      },
    ],
  },
};

/** @returns {LocalizedSeoPage | null} */
export function getChristmasSeoContent(basePath) {
  return CHRISTMAS_SEO_CONTENT[basePath] || null;
}
