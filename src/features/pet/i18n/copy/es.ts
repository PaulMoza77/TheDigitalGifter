import type { PetCopyMap } from "./en";

/** Spanish copy for /pet (V1 + V2 funnel). */
export const PET_COPY_ES: PetCopyMap = {
  // Species
  "species.dog": "Perro",
  "species.cat": "Gato",
  "species.other": "Otro",
  "species.otherHint": "Otra mascota",
  "species.pet": "mascota",
  "species.dogLower": "perro",
  "species.catLower": "gato",
  "species.golden": "Golden Retriever",
  "species.tablist": "Tipo de mascota",

  // Shared chrome
  "chrome.back": "Atrás",
  "chrome.lang": "Idioma",
  "chrome.before": "Antes",
  "chrome.after": "Después",
  "chrome.clipBadge": "Clip de 5 s",
  "chrome.optional": "(opcional)",
  "chrome.endsIn": "Termina en {countdown}",

  // V2 landing
  "v2.landing.eyebrow": "Pruébalo gratis",
  "v2.landing.h1": "Ve a tu mascota como piloto de Fórmula 1.",
  "v2.landing.lede":
    "Sube una foto y recibe un teaser difuminado gratis de la vida secreta de {pet} — sin tarjeta.",
  "v2.landing.cta": "Sube la foto de tu mascota",
  "v2.landing.chooseFile": "Elige un JPEG, PNG o WebP",
  "v2.landing.bullet.lives": "12 vidas secretas",
  "v2.landing.bullet.clips": "2 miniclips",
  "v2.landing.bullet.price": "{price} pago único",
  "v2.landing.bullet.teaser": "Teaser en segundos",
  "v2.landing.bullet.noSub": "Sin suscripción",
  "v2.landing.bullet.private": "La foto se queda privada",
  "v2.landing.proofAria": "Ejemplos de retratos y clips",
  "v2.landing.livesH2": "Las 12 vidas secretas",
  "v2.landing.livesLede.dog":
    "Doce retratos del mismo {pet} — cada mundo incluido. 2 miniclips incluidos.",
  "v2.landing.livesLede.other": "Doce retratos. Una foto. Muchos tipos de mascotas.",
  "v2.landing.closingH2": "Revela la vida secreta de tu mascota.",
  "v2.landing.closingLede":
    "Sube una foto para un teaser personalizado gratis. Desbloquea 12 vidas secretas y 2 miniclips por {price} hoy.",
  "v2.landing.closingRenew": "{compare} {price} · la oferta se renueva cada 24 horas",
  "v2.landing.saleLine": "{compare} {price} hoy · quedan {countdown}",
  "v2.landing.stickySale": "{compare} → {price} hoy · quedan {countdown}",
  "v2.landing.stickyIdle": "{price} pago único · sin tarjeta para la vista previa gratis",
  "v2.landing.originalAlt": "Foto original del {pet} de demo",
  "v2.landing.afterAlt": "Vista previa de piloto de Fórmula 1 del mismo {pet} de demo",
  "v2.landing.clipAlt": "Miniclip {title}",
  "v2.landing.exampleAlt": "Ejemplo {title}",

  // V2 pack / offer chrome
  "v2.pack.badge": "Oferta de 24 horas",
  "v2.pack.headline": "Consigue 12 vidas secretas y 2 miniclips por solo {price}",
  "v2.pack.headlineRich": "Consigue 12 vidas secretas y 2 miniclips por solo",
  "v2.pack.fine": "Pago único · sin suscripción · la misma mascota en cada retrato y clip",
  "v2.shell.footer": "{headline}. Teaser personalizado gratis — paga solo para desbloquear.",

  // V2 photo
  "v2.photo.h1": "Una foto nítida.",
  "v2.photo.lede":
    "De frente a la cámara, ambos ojos visibles, luz uniforme. Solo un {pet} — sin fotos de grupo ni filtros fuertes.",
  "v2.photo.selectedAlt": "Foto de mascota seleccionada",
  "v2.photo.selectedNamed": "{fileName} seleccionado",
  "v2.photo.replace": "Sustituir",
  "v2.photo.remove": "Quitar",
  "v2.photo.choose": "Elegir una foto",
  "v2.photo.formats": "JPEG, PNG o WebP · máx. 15 MB",
  "v2.photo.cta": "Ver mi teaser de vida secreta",
  "v2.photo.viewTeaser": "Ver mi teaser",
  "v2.photo.confirm.dog": "Confirmo que esta foto muestra a mi perro (no un gato u otro animal).",
  "v2.photo.confirm.cat": "Confirmo que esta foto muestra a mi gato (no un perro u otro animal).",
  "v2.photo.confirmErr.dog":
    "Esta experiencia está pensada para perros. Confirma que la foto muestra a tu perro, o sube una foto clara de un perro.",
  "v2.photo.confirmErr.cat":
    "Esta experiencia está pensada para gatos. Confirma que la foto muestra a tu gato, o sube una foto clara de un gato.",
  "v2.photo.needPhoto": "Elige una foto primero.",

  // V2 teaser / checkout
  "v2.teaser.h1": "La vida secreta de tu {pet} está lista para revelarse.",
  "v2.teaser.support": "Desbloquea la colección personalizada completa 12+2 por {price}.",
  "v2.teaser.alt": "Vista previa difuminada de la vida secreta de tu mascota",
  "v2.teaser.bullet.lives": "12 vidas secretas del mismo {pet}",
  "v2.teaser.bullet.clips": "2 miniclips cinematográficos",
  "v2.teaser.bullet.price": "Pago único de {price} — sin suscripción",
  "v2.teaser.petName": "Nombre de la mascota",
  "v2.teaser.email": "Correo para la galería",
  "v2.teaser.payAria": "Pago seguro",
  "v2.teaser.reupload": "Vuelve a subir la foto de tu mascota",
  "v2.teaser.hostedHint": "Continúa en la página de pago seguro de Stripe para terminar tu pago único.",
  "v2.teaser.hostedOpening": "Abriendo el pago seguro de Stripe…",
  "v2.teaser.hostedBusy": "Abriendo el pago seguro de Stripe…",
  "v2.teaser.hostedCta": "Continuar al pago seguro de Stripe — {price}",
  "v2.teaser.retry": "Abrir el pago seguro de Stripe — {price}",
  "v2.teaser.retrying": "Reintentando…",
  "v2.teaser.busyPay": "Procesando el pago seguro…",
  "v2.teaser.loadingPay": "Cargando el pago seguro…",
  "v2.teaser.preparing": "Preparando el pago seguro…",
  "v2.teaser.paused":
    "El pago seguro está en pausa hasta que se restablezca la capacidad de generación. No se te ha cobrado.",
  "v2.teaser.secureLine": "Pago único seguro de {price} con Stripe. Sin suscripción.",
  "v2.teaser.payDog": "Revelar la vida secreta de mi perro — {price}",
  "v2.teaser.payCat": "Revelar la vida secreta de mi gato — {price}",
  "v2.teaser.payPet": "Revelar la vida secreta de mi mascota — {price}",
  "v2.teaser.sessionExpiredContact": "La sesión de pago caducó. Reintenta el pago seguro.",

  // V2 offer (legacy step)
  "v2.offer.h1": "Desbloquea la colección",
  "v2.offer.lede": "{headline}. Pago único. Sin suscripción.",
  "v2.offer.bullet.lives": "12 vidas secretas de la misma mascota",
  "v2.offer.bullet.clips": "2 miniclips cinematográficos",
  "v2.offer.bullet.ready": "Suele estar listo unos minutos después del pago",
  "v2.offer.bullet.remake":
    "Si un resultado de pago no se parece claramente a tu mascota, lo refacemos",
  "v2.offer.cta": "Consigue 12 vidas + 2 clips por {price}",
  "v2.offer.opening": "Abriendo el pago seguro…",
  "v2.offer.fine": "Pago seguro con Stripe. No se te cobrará dos veces.",

  // V2 generating / preview (legacy)
  "v2.gen.h1": "Creando la vista previa de piloto F1 de tu mascota",
  "v2.gen.lede":
    "Estamos convirtiendo a tu mascota en un piloto cinematográfico de Fórmula 1. Es una vista previa gratis — aún no la colección completa.",
  "v2.gen.retry": "Intentar de nuevo",
  "v2.gen.change": "Cambiar foto",
  "v2.gen.thumbAlt": "Tu mascota subida",
  "v2.preview.eyebrow": "Vista previa cinematográfica gratis",
  "v2.preview.h1Named": "{name} como piloto de F1",
  "v2.preview.h1": "Tu {pet} como piloto de F1",
  "v2.preview.lede":
    "La vida secreta de tu {pet} empieza aquí. Desbloquea la colección completa para ver aún más transformaciones increíbles.",
  "v2.preview.yourPhoto": "Tu foto",
  "v2.preview.f1": "Vista previa F1",
  "v2.preview.uploadAlt": "Tu {pet} subido",
  "v2.preview.f1Alt": "Tu {pet} como piloto de Fórmula 1",
  "v2.preview.mock":
    "Vista previa de prototipo: la generación IA en vivo está desactivada en este entorno, así que es tu foto con un encuadre estilo F1.",
  "v2.preview.unlock": "Desbloquear colección completa — {price}",
  "v2.preview.regen": "Probar otra vista previa gratis",

  // Checkout loading phases
  "v2.checkout.preparing_photo": "Preparando tu foto…",
  "v2.checkout.creating_order": "Iniciando el pago seguro…",
  "v2.checkout.uploading": "Subiendo tu foto…",
  "v2.checkout.creating_session": "Cargando el pago seguro…",
  "v2.checkout.expired":
    "Tu sesión de pago seguro caducó. Vuelve a subir la foto de tu mascota.",
  "v2.checkout.failed":
    "No pudimos abrir el formulario de pago seguro. Inténtalo de nuevo. No se te ha cobrado.",
  "v2.provider.unavailable":
    "De momento no podemos crear nuevas transformaciones. Inténtalo en breve — no se te ha cobrado.",

  // Preview errors
  "v2.err.invalid_funnel":
    "Esta vista previa no coincide con la experiencia actual. Actualiza e inténtalo de nuevo.",
  "v2.err.rate_limited":
    "Esta sesión ya usó sus vistas previas gratis. Desbloquea la colección o inténtalo mañana.",
  "v2.err.timeout":
    "Tu vista previa sigue renderizándose. Espera un momento y pulsa Intentar de nuevo — retomaremos donde se quedó.",
  "v2.err.rate_limit":
    "El servicio de vista previa está ocupado. Pulsa Intentar de nuevo en un momento — suele desbloquearse rápido.",
  "v2.err.wrong_species":
    "Esa foto no encaja con esta experiencia. Sube una foto clara de la mascota correcta.",
  "v2.err.invalid_image": "Esa foto no se pudo usar. Prueba un JPEG, PNG o WebP más pequeño.",
  "v2.err.provider_auth": "La generación de vistas previas no está disponible temporalmente. Inténtalo en unos minutos.",
  "v2.err.endpoint_unreachable":
    "No pudimos llegar al servicio de vista previa. Comprueba tu conexión e inténtalo de nuevo.",
  "v2.err.server_error":
    "Algo se quedó atascado de un intento anterior. Pulsa Intentar de nuevo o sustituye la foto para una vista previa nueva.",
  "v2.err.provider_error":
    "No pudimos terminar la vista previa esta vez. Inténtalo de nuevo, o sustituye la foto si sigue fallando.",

  // V1 product / landing
  "v1.product.name": "La Vida Secreta de Mi Mascota",
  "v1.product.promise": "Una foto. 12 vidas secretas. 2 clips cinematográficos.",
  "v1.hero.subtitle":
    "Ve a tu mascota como realeza, astronauta, CEO y más — la misma cara en cada mundo.",
  "v1.hero.promise": "Una foto. 12 vidas secretas. 2 clips cinematográficos.",
  "v1.offer.noSub": "Sin suscripción",
  "v1.offer.include.portraits": "12 retratos de la misma mascota",
  "v1.offer.include.clips": "2 clips cinematográficos de 5 segundos",
  "v1.offer.include.review": "Revisión humana antes de la descarga",
  "v1.offer.include.price": "Precio único — sin suscripción",
  "v1.landing.dog.heading": "Doce vidas secretas",
  "v1.landing.dog.description":
    "Pasa el cursor o toca un retrato para verlo moverse. El mismo Golden Retriever. Un mundo distinto en cada fotograma.",
  "v1.landing.dog.support":
    "Convierte a tu perro en realeza, astronauta, CEO y nueve vidas secretas más.",
  "v1.landing.cat.heading": "Doce vidas secretas",
  "v1.landing.cat.description":
    "Pasa el cursor o toca un retrato para verlo moverse. El mismo gato. Un mundo distinto en cada fotograma.",
  "v1.landing.cat.support":
    "Convierte a tu gato en realeza, astronauta, CEO y nueve vidas secretas más.",
  "v1.landing.other.heading": "Hecho para muchos tipos de mascotas",
  "v1.landing.other.description":
    "Pasa el cursor o toca un retrato para verlo moverse. Toda mascota merece una vida secreta.",
  "v1.landing.other.support": "Toda mascota merece una vida secreta.",
  "v1.clips.heading": "Dos clips cinematográficos",
  "v1.clips.dog": "La misma mascota. Cinco segundos. Un mundo en movimiento.",
  "v1.clips.cat": "El mismo gato. Cinco segundos. Un mundo en movimiento.",
  "v1.clips.other": "Ejemplos en movimiento de cinco segundos para distintos tipos de mascotas.",
  "v1.guarantee.heading": "La Garantía Misma Mascota",
  "v1.guarantee.body":
    "Cada retrato y clip lo revisa una persona. Si un resultado no se parece claramente a tu mascota, lo refacemos antes de la entrega.",
  "v1.seo.dog.title": "Retratos y Vídeos Personalizados de Perro | La Vida Secreta de Mi Mascota",
  "v1.seo.dog.description":
    "Convierte una foto de tu perro en 12 retratos personalizados y 2 clips cinematográficos de 5 segundos. La misma cara en cada mundo. Pago único. Sin suscripción.",
  "v1.seo.cat.title": "Retratos y Vídeos Personalizados de Gato | La Vida Secreta de Mi Mascota",
  "v1.seo.cat.description":
    "Convierte una foto de tu gato en 12 retratos personalizados y 2 clips cinematográficos de 5 segundos. La misma cara en cada mundo. Pago único. Sin suscripción.",
  "v1.seo.other.title": "Retratos y Vídeos Personalizados de Mascotas | La Vida Secreta de Mi Mascota",
  "v1.seo.other.description":
    "Retratos personalizados y clips cinematográficos para conejos, aves, mascotas pequeñas, reptiles, caballos y otros animales. Una foto. Revisado por humanos. Pago único.",

  // Subtypes
  "subtype.rabbit": "Conejo",
  "subtype.bird": "Ave",
  "subtype.small_pet": "Mascota pequeña",
  "subtype.reptile": "Reptil",
  "subtype.horse": "Caballo",
  "subtype.other": "Otro",

  // Other gallery subjects
  "other.royal-portrait": "Tortuga",
  "other.luxury-ceo": "Guacamayo",
  "other.astronaut": "Hámster",
  "other.formula-racer": "Conejo",
  "other.spa-bathtub": "Erizo",
  "other.newspaper": "Cobaya",
  "other.cinema-boss": "Dragón barbudo",
  "other.renaissance": "Hurón",
  "other.beach-vacation": "Pez dorado",
  "other.head-chef": "Mini cerdo",
  "other.original-superhero": "Camaleón",
  "other.christmas-portrait": "Ninfa",
  "other.mixedGallery": "Ejemplos de mascotas variadas",

  // Scenes
  "scene.royal-portrait.title": "Retrato real",
  "scene.royal-portrait.tagline": "La corona es opcional. La mirada, no.",
  "scene.luxury-ceo.title": "CEO de lujo",
  "scene.luxury-ceo.tagline": "Premios trimestrales. Oficina abierta. Patas cerradas.",
  "scene.astronaut.title": "Astronauta",
  "scene.astronaut.tagline": "Un pequeño paso para las patas. Un gran salto para los snacks.",
  "scene.formula-racer.title": "Piloto de carreras Fórmula",
  "scene.formula-racer.tagline": "Pole position. Caricias en el pit stop.",
  "scene.spa-bathtub.title": "Spa / bañera",
  "scene.spa-bathtub.tagline": "Pepinos opcionales. Dignidad no negociable.",
  "scene.newspaper.title": "Leyendo el periódico",
  "scene.newspaper.tagline": "Última hora: la siesta se mueve a las 14:15.",
  "scene.cinema-boss.title": "Jefe de cine ficticio",
  "scene.cinema-boss.tagline": "Una oficina inventada. Una mirada muy real.",
  "scene.renaissance.title": "Pintura renacentista",
  "scene.renaissance.tagline": "Óleo, terciopelo y 400 años de miradas de reojo.",
  "scene.beach-vacation.title": "Vacaciones en la playa",
  "scene.beach-vacation.tagline": "Fuera de la oficina. Siguiendo juzgando a las gaviotas.",
  "scene.head-chef.title": "Chef ejecutivo",
  "scene.head-chef.tagline": "La cocina está cerrada. El crítico es peludo.",
  "scene.original-superhero.title": "Superhéroe original",
  "scene.original-superhero.tagline": "Una capa inventada. Una ciudad que ya controlan.",
  "scene.christmas-portrait.title": "Retrato de Navidad",
  "scene.christmas-portrait.tagline": "La tarjeta anual que sí acaba enmarcada.",

  // How it works
  "how.1.title": "Ponle nombre a tu mascota",
  "how.1.body": "Con el nombre de pila basta. Aún no se cobra.",
  "how.2.title": "Sube una foto",
  "how.2.body": "Cara clara, de frente. Añade tu correo.",
  "how.3.title": "Revisa y paga una vez",
  "how.3.body": "Sin suscripción. Sin renovación. Pago con Stripe.",
  "how.4.title": "Recibe 12 retratos y 2 clips",
  "how.4.body": "La misma mascota. Replicate empieza justo después del pago.",

  // FAQs
  "faq.sub.q": "¿Es una suscripción?",
  "faq.sub.a": "No. Pago único. Nada se renueva.",
  "faq.look.q": "¿Se parecerá a mi mascota?",
  "faq.look.a":
    "Sí — ese es el producto. Una foto, doce escenas, dos clips cinematográficos, la misma cara. Una persona revisa antes de que descargues.",
  "faq.time.q": "¿Cuánto tarda?",
  "faq.time.a":
    "Suele ser unos minutos después del pago. Replicate empieza los doce retratos al momento.",
  "faq.photo.q": "¿Qué foto funciona mejor?",
  "faq.photo.a":
    "Una mascota, de frente a la cámara, ambos ojos visibles, luz uniforme. Sin fotos de grupo ni filtros fuertes.",
  "faq.gift.q": "¿Puedo regalarlo?",
  "faq.gift.a": "Sí. Usa la foto de su mascota, paga una vez y envía el enlace de la galería.",
  "faq.remake.q": "¿Y si un retrato no se parece a mi mascota?",
  "faq.remake.a":
    "Abre Ayuda en la página de tu pedido y envía un ticket. Si un resultado no se parece claramente a tu mascota, lo refacemos.",
  "faq.private.q": "¿Mi foto original es privada?",
  "faq.private.a":
    "Tu foto solo se usa para crear este pedido. No se usa como marketing público. No la vendemos.",
  "faq.multi.q": "¿Puedo incluir varias mascotas?",
  "faq.multi.a":
    "No en un solo pedido. Usa una foto clara con una sola mascota. Las fotos de grupo se rechazan antes de la generación.",
  "faq.human.q": "¿Qué significa «revisado por humanos»?",
  "faq.human.a":
    "Los retratos están listos en cuanto termina la generación. Si algo no encaja, abre Ayuda y lo refaremos.",
  "faq.formats.q": "¿Qué formatos de archivo recibo?",
  "faq.formats.a":
    "Recibes los archivos de retrato generados y dos clips MP4 cinematográficos desde la galería del pedido. Recortes extra como fondos de pantalla aún no están incluidos.",

  // Validation
  "validate.name": "Ponle un nombre a tu mascota — incluso un apodo vale.",
};
