import { HomeNews } from './home.model';

/** A platform news item: its id, day, title, short text, the news in full and, optionally, the page it is about. */
function item(
  id: string,
  date: string,
  title: string,
  excerpt: string,
  body: string,
  link?: [string, string],
): HomeNews {
  return {
    id: `platform-${id}`,
    date: `${date}T12:00`,
    title,
    excerpt,
    body,
    cardIds: [],
    linkRoute: link?.[0] ?? null,
    linkLabel: link?.[1] ?? null,
  };
}

const SIMULATOR: [string, string] = ['/simulator', 'Ir al simulador'];
const PLAY: [string, string] = ['/play', 'Ir a Jugar'];

/**
 * The platform's history as news: its improvements since ERAS 2.0 (the big update with the new look and the automatic
 * simulator, October 2026), from the web's and the server's history. In the news log with the home's news; the
 * carousel shows the latest of them all.
 */
export const PLATFORM_NEWS: HomeNews[] = [
  item(
    '20261123-mazos-sistema',
    '2026-11-23',
    'Mazos del sistema y un reverso nuevo',
    'En Mazos públicos hay una pestaña Sistema con los mazos de ERAS por edición, y ahora eliges el reverso de tus cartas.',
    'Mazos públicos se ordena en dos pestañas, Sistema y Comunidad, con una búsqueda con filtros. En Sistema están los mazos de ERAS: los de E1 por color, los de los arquetipos de cada edición y los cuatro de estructura, en carpetas por edición. El bot juega con estos mazos, con variaciones.\n\n' +
      'En Mi perfil, en las preferencias de la Mesa, eliges el reverso de tus cartas: Vórtice, el nuevo y predeterminado, o Clásico. Tu rival ve tu reverso en la mesa.\n\n' +
      'También estrenamos los emblemas de las ligas, con Retador como la gema de ERAS en los cinco colores, y el ícono nuevo de la gema. En el historial, "Mazo rival" muestra la lista que usó tu oponente.',
    ['/public-decks', 'Ver los mazos'],
  ),
  item(
    '20261122-e13',
    '2026-11-22',
    'E1.3 completa en el simulador',
    'Las 15 cartas de E1.3 ya funcionan en el simulador: la edición se puede jugar entera.',
    'Se programaron las 15 cartas de E1.3, como Soldado Invernal, Leucothi, Gumxo, Sable Templario y Hacha Templaria, y con ellas la edición queda completa en el simulador.\n\n' +
      'Fal, Batalla por la Frontera Interdimensional y Limpiador Errante se ajustaron a sus textos nuevos.',
    ['/cards/editions/E1.3', 'Ver la edición'],
  ),
  item(
    '20261122-mano',
    '2026-11-22',
    'Una mano más cómoda',
    'Tu mano siempre queda a la vista sobre la mesa, y el material de una invocación especial puede venir de ella.',
    'Cuando miras a través de los paneles, tu mano se eleva para que no la pierdas de vista, y los Materiales de una carta se listan uno por línea.\n\n' +
      'El material de una invocación especial por efecto ahora puede venir de la mano.',
    SIMULATOR,
  ),
  item(
    '20261121-brillo-3d',
    '2026-11-21',
    'Cartas con brillo, visor 3D y vidas que se juegan',
    'Las cartas muestran su brillo y sus bordes dorados, puedes girarlas en 3D, y una vida revelada que se puede jugar queda lista para jugarla.',
    'Cada carta muestra su barniz y su oro, y el foil la cubre entera salvo esas partes. En el visor 3D la carta se inclina con luz y grosor. Todo el sitio dibuja las cartas de la misma forma.\n\n' +
      'Si una vida revelada es una utilidad o una estructura que puedes jugar, queda sobre tus vidas para que la juegues; si no la juegas, va a tu mano. En el tablero, las acciones de una carta son íconos sobre ella, y mantenerla pulsada la muestra en detalle.',
    SIMULATOR,
  ),
  item(
    '20261121-solo-clasificatorio',
    '2026-11-21',
    'Modo solo clasificatorio con un rival de verdad',
    'En el Modo solo clasificatorio enfrentas a un rival con nombre y mazo propio, y no sabes quién es hasta que empieza la partida.',
    'Antes de empezar, el asiento del rival dice solo "Rival". El bot juega con un nombre de jugador y un mazo de su propio repertorio, y si vuelves a la presala te toca un rival nuevo. En la presala ves tu rango.\n\n' +
      'El bot también juega mejor: confirma que una victoria que encontró resiste cualquier bloqueo y planifica sus ataques junto con el resto del turno. El Modo solo amistoso no avanza las misiones, aunque sí cuenta para tu progreso.',
    PLAY,
  ),
  item(
    '20261119-cartas-prueba',
    '2026-11-19',
    'Cartas en prueba abiertas a todos',
    'Todos pueden ver y jugar las cartas en prueba de los arquetipos nuevos en partidas amistosas.',
    'Las búsquedas del catálogo y del constructor tienen un selector: Cartas legales, Todas las cartas o Cartas en test. Por defecto se ven solo las legales.\n\n' +
      'Las cartas en prueba no se venden ni se fabrican, y nunca cuentan como faltantes en tu colección. Puedes usarlas en partidas amistosas, no en clasificatorias. Entre otras, ya están Ángeles, Paladines, Lanzadores de Conjuros, Kuwal, Treant, Hadas, Dinosaurios, Autómatas, Wyvernos, Chamán, Ajedrez, Hydras y Cortesanas.',
    ['/cards', 'Ver las cartas'],
  ),
  item(
    '20261119-e12',
    '2026-11-19',
    'E1.2 completa en el simulador',
    'Las cartas de E1.2 que faltaban ya tienen sus efectos: la edición se puede jugar entera.',
    'Llegaron las cartas de E1.2 que aún no se podían jugar, con los textos que ajustó el diseñador, y con ellas la edición queda completa en el simulador.',
    ['/cards/editions/E1.2', 'Ver la edición'],
  ),
  item(
    '20261119-e11',
    '2026-11-19',
    'E1.1 completa en el simulador',
    'Las cartas de E1.1 que faltaban ya tienen sus efectos: la edición se puede jugar entera.',
    'Llegaron 23 cartas de E1.1 que aún no se podían jugar, y Nuliber y Niobats se ajustaron a su texto actual. Con ellas la edición queda completa en el simulador.\n\n' +
      'El motor entiende ahora el límite "dos veces por turno", tanto por copia como entre copias de la misma carta.',
    ['/cards/editions/E1.1', 'Ver la edición'],
  ),
  item(
    '20261119-robo-detalle',
    '2026-11-19',
    'Roba tu carta y mira cada carta a fondo',
    'Al empezar tu turno, tu mazo sube al centro en 3D y robas con un clic. Al pulsar una carta de la mesa ves todo su detalle.',
    'El mazo se ve con el volumen de las cartas que le quedan, y la carta robada se da vuelta en 3D y vuela a tu mano.\n\n' +
      'Al pulsar una carta de la mesa, junto al tablero aparecen sus Materiales, sus Recursos, sus valores y modificadores, sus efectos propios y los que recibe por enlace. El efecto que te pide una elección queda resaltado, y las cartas que pasan de una pila a otra salen una tras otra.',
    SIMULATOR,
  ),
  item(
    '20261118-constructor',
    '2026-11-18',
    'Un constructor de mazos más claro',
    'En el constructor ves la rareza de cada carta y el mazo entero en una cuadrícula, en su orden.',
    'La pestaña de rareza aparece en las cartas del mazo, en la búsqueda y en el detalle. El mazo se muestra como una cuadrícula con cada copia, sin agrupar por tipo.\n\n' +
      'El brillo prismático usa el mismo patrón en todos los tamaños, sin cortes. En las ediciones, una reimpresión indica cuál fue su primera impresión.',
    ['/deck-builder', 'Ir al constructor'],
  ),
  item(
    '20261117-estructura',
    '2026-11-17',
    'Nuevos mazos de estructura',
    'ST1 a ST4 se renuevan con mazos nuevos, y los anteriores pasan a llamarse ST5 a ST8.',
    'Los mazos de estructura que había pasan a llamarse ST5 a ST8, y los nuevos ST1, ST2, ST3 y ST4 llegan programados con sus efectos y requisitos.\n\n' +
      'El botón de efectos opcionales tiene tres modos: Sí, Auto (el predeterminado, que no te ofrece reductores de coste innecesarios) y No.',
    SIMULATOR,
  ),
  item(
    '20261117-e1',
    '2026-11-17',
    'E1 completa en el simulador',
    'Las cartas de E1 de los cinco colores tienen sus efectos y requisitos en el simulador: la edición se puede jugar entera.',
    'Azul, Verde, Violeta, Roja y Blanca: cada carta de E1 tiene sus efectos y sus requisitos de invocación especial y de ritual en el motor, con las piezas nuevas que necesitaban.\n\n' +
      'Las cartas se ajustaron a su texto impreso, y con ellas la primera edición queda completa en el simulador.',
    ['/cards/editions/E1', 'Ver la edición'],
  ),
  item(
    '20261115-enlace',
    '2026-11-15',
    'Llega el Enlace: formaciones en la Línea frontal',
    'Ahora enlazas criaturas de la Línea frontal en formaciones, arrastrando una sobre tu campo.',
    'Las criaturas con flechas las muestran en sus bordes, encendidas cuando apuntan a la carta de al lado, y los miembros de una formación comparten una banda.\n\n' +
      'Para enlazar, en tu fase principal arrastras una criatura y eliges dónde se une. Al entrar a la Línea frontal, la criatura elige su enlace en ese momento. El detalle de la carta muestra los efectos de enlace que recibe.',
    SIMULATOR,
  ),
  item(
    '20261111-bot',
    '2026-11-11',
    'Un bot más sensato',
    'El bot dejó de regalar criaturas en ataques inútiles y protege mejor su mesa.',
    'El bot sigue ahora dos reglas: no ataca si eso solo entrega una criatura, y no deja su mesa expuesta a las criaturas del rival que tiene a la vista. Para pagar materiales usa primero los Tributos, después la mano y por último el campo.\n\n' +
      'También entraron varias rondas de correcciones del diseñador a cartas de E1, E1.1, E1.2 y ST3.',
    PLAY,
  ),
  item(
    '20261109-preferencias',
    '2026-11-09',
    'Tus preferencias te acompañan y un banner para tu perfil',
    'Tus preferencias se guardan con tu cuenta y tu perfil suma un banner que encuadras tú.',
    'Las preferencias se guardan con tu cuenta, así que te siguen a cualquier dispositivo.\n\n' +
      'En tu perfil editas el banner y el ícono directamente en la cabecera, con un encuadrador de imagen. El tapete pasa a ser una preferencia de la mesa, y el historial de partidas tiene su propia vista.',
    ['/profile', 'Ir a mi perfil'],
  ),
  item(
    '20261109-mesa-arcana',
    '2026-11-09',
    'Mesa arcana y cadenas paso a paso',
    'La mesa estrena un estilo arcano, que es el predeterminado, y cada eslabón de la cadena se resuelve a la vista.',
    'La mesa arcana es de piedra oscura, con zonas grabadas con esquinas de oro, un contador de gemas talladas y placas doradas para el turno y la fase. Si prefieres la mesa limpia, puedes volver a ella.\n\n' +
      'Las preferencias de partida se ordenan en pestañas: Mesa, Mano y Pantalla. Las líneas del campo se deslizan arrastrando, como la mano, y todo el sitio se ve mejor en teléfonos en horizontal.',
    SIMULATOR,
  ),
  item(
    '20261108-android',
    '2026-11-08',
    'ERAS para Android',
    'Descarga la app para Android desde Jugar. Se actualiza sola y te avisa cuando hay una versión nueva.',
    'La app funciona igual que la versión instalada: abre al instante, juega sin conexión y guarda las imágenes de las cartas.\n\n' +
      'Las mejoras de la web le llegan como actualizaciones automáticas, nunca en medio de una partida. Si una mejora necesita una app nueva, verás el aviso "Hay una nueva versión de la app". El botón Atrás del teléfono cierra los diálogos y vuelve a la pantalla anterior.',
    PLAY,
  ),
  item(
    '20261108-sin-conexion',
    '2026-11-08',
    'Instala ERAS y juega sin conexión',
    'Instala ERAS como app y juega contra el bot sin internet; tus partidas sin conexión cuentan al conectarte.',
    'El Modo solo sin conexión ejecuta el motor de reglas en tu dispositivo, sin el servidor: eliges tu mazo y el nivel del bot. En Jugar están "Instalar ERAS" y "Descargar para jugar sin conexión", que guarda las imágenes de las cartas.\n\n' +
      'La app instalada abre sin esperar al servidor, siempre en horizontal y a pantalla completa. Lo que necesita conexión se conecta cuando lo pides. Tus partidas sin conexión se guardan y se envían al conectarte, y desde ahora las partidas contra el bot también cuentan para misiones y progreso.',
    PLAY,
  ),
  item(
    '20261106-perfil',
    '2026-11-06',
    'Perfil nuevo con tapete e historial',
    'Tu perfil muestra quién eres, tu tapete y tus últimas partidas, cada una con su repetición.',
    'El perfil abre con tu ícono, tu nombre y tu rango sobre tu tapete. Subes el tapete como imagen, y ambos jugadores lo ven bajo tu mitad de la mesa.\n\n' +
      'El historial incluye tus partidas online y de Modo solo, cada una con "Ver repetición".',
    ['/profile', 'Ir a mi perfil'],
  ),
  item(
    '20261106-repeticiones',
    '2026-11-06',
    'Repeticiones, Sala de pruebas y mesa en 3D',
    'Mira la repetición de tus partidas, practica en la Sala de pruebas y juega en una mesa inclinada en 3D.',
    'Hay tres modos de juego: Online, Modo solo y Sala de pruebas. En la Sala de pruebas puedes pausar a los bots y avanzar o retroceder jugada a jugada.\n\n' +
      'Las animaciones se muestran en orden: efecto, eslabón, ataque, bloqueo, golpe y destrucción, con las cartas volando en 3D sobre la mesa inclinada. Un botón redondo abre el Menú de partida, con el historial, las preferencias y la opción de salir o rendirte.',
    SIMULATOR,
  ),
  item(
    '20261106-ligas',
    '2026-11-06',
    'Partidas clasificatorias: de Hierro a Retador',
    'Juega partidas clasificatorias, online o contra el bot, y sube por las ligas y sus divisiones hasta Retador.',
    'Las ligas van de Hierro a Retador, cada una con sus divisiones. Platino y Diamante piden series de ascenso, hay escudos que te protegen de bajar, y Retador tiene su propia tabla de puntos.\n\n' +
      'Puedes buscar rival en una cola automática o entrar a salas clasificatorias. En Social, la Clasificación muestra tu rango, la tabla de Retador y una guía de cada liga, y cuando cambias de rango lo ves en la pantalla final.',
    ['/ranking', 'Ver la clasificación'],
  ),
  item(
    '20261103-artes-alternativos',
    '2026-11-03',
    'Artes alternativos y roturas de sobre según la rareza',
    'Algunas cartas tienen artes alternativos muy raros que pueden salir en los sobres, y la rotura del sobre se intensifica con su rareza.',
    'Un arte alternativo es una versión muy rara de la misma carta, que también puede salir foil o prismática. Lo ves en tu colección, el catálogo, el constructor y la mesa.\n\n' +
      'La rotura del sobre crece con su rareza: simple en uno normal y más intensa en SR, SEC y GOD, con las cartas saliendo a volar. Los nombres de mazo admiten ahora hasta 30 caracteres.',
    ['/editions', 'Ir a la tienda'],
  ),
  item(
    '20261102-telefono',
    '2026-11-02',
    'Juega desde tu teléfono',
    'El simulador funciona en el teléfono: a pantalla completa, con la mesa compacta en horizontal y gestos táctiles.',
    'Abierto desde la pantalla de inicio, funciona sin las barras del navegador. En horizontal la mesa es más compacta, y si sostienes el teléfono en vertical te pide girarlo.\n\n' +
      'Una pulsación larga abre el menú de una carta o de una pila.',
    SIMULATOR,
  ),
  item(
    '20261102-misiones',
    '2026-11-02',
    'Misiones diarias y semanales, y la Bienvenida',
    'Cada día recibes tres misiones y cada semana otras tres más largas; al cumplirlas reclamas gemas.',
    'Las misiones te piden, por ejemplo, iniciar sesión, jugar o ganar partidas, invocar criaturas o hacer daño.\n\n' +
      'En Misiones también está Progreso, con la cadena de Bienvenida y los logros, que te guía en tus primeros pasos e incluye la elección de tu mazo de estructura. Todas las cartas boca abajo muestran ahora el reverso del juego.',
    ['/missions', 'Ir a Misiones'],
  ),
  item(
    '20261102-coleccion',
    '2026-11-02',
    'Tu colección: fragmentos, romper y fabricar',
    'Las cartas que abres van a tu colección. Rompe las copias que te sobran en fragmentos y fabrica las que te faltan.',
    'Cada copia tiene un acabado: normal, foil o prismático. Las cartas que no tienes se ven en gris en el constructor.\n\n' +
      'Al romper una copia ganas fragmentos según su rareza, y con ellos fabricas copias. "Fabricar cartas no poseídas" completa un mazo de una vez. Para jugar un mazo en el simulador necesitas tener todas sus copias, y cada carta se ve en el mejor acabado que tengas, también en la mesa.',
    ['/deck-builder', 'Ir al constructor'],
  ),
  item(
    '20261102-tienda',
    '2026-11-02',
    'Abre la tienda: sobres, cajas y mazos de estructura',
    'Compra sobres, cajas y mazos de estructura con gemas, y ábrelos con una animación carta por carta.',
    'Tus gemas se guardan en tu cuenta. Cada edición vende un sobre, cuyo tipo sale al azar con las mismas probabilidades que en una caja, y su caja completa; la página de la edición muestra esas probabilidades y las cartas que trae. Los mazos de estructura se venden enteros, una vez por cuenta.\n\n' +
      'En la apertura, los sobres se rompen uno a uno y las cartas se dan vuelta de a una o todas juntas; las foil y las prismáticas brillan.',
    ['/editions', 'Ir a la tienda'],
  ),
  item(
    '20261102-home',
    '2026-11-02',
    'Una portada de juego: Jugar, Social y Modo solo',
    'La portada es ahora un centro de acción, con las secciones Jugar y Social, y el Modo solo contra el bot está abierto a todos.',
    'La portada muestra el arte de las ediciones, tu placa de jugador, un carrusel de novedades, tu siguiente paso y el botón "Jugar ahora". Jugar reúne Online, Modo solo y Tutorial; Social reúne los mazos públicos y la tierlist.\n\n' +
      'La sala de espera se renovó: los dos asientos frente a frente, la opción "¿Quién empieza?" y un aviso cuando no puedes usar un mazo.',
    PLAY,
  ),
  item(
    '20261031-animaciones',
    '2026-10-31',
    'Cadenas y combates animados, y ataques arrastrando',
    'Ahora ves animada cada cadena y cada combate, y atacas arrastrando tu criatura hasta su objetivo.',
    'Los eslabones de la cadena aparecen en zigzag y luego ves la resolución de cada uno. Se animan la carga del ataque, la destrucción, los cambios de fuerza y de gemas, las invocaciones y los barajados.\n\n' +
      'La partida abre con una pantalla de enfrentamiento y cierra con una de victoria o derrota. Tu ícono de jugador puede ser una imagen que subes tú.',
    SIMULATOR,
  ),
  item(
    '20261030-sin-programar',
    '2026-10-30',
    'Aviso de cartas sin programar',
    'El constructor y el simulador te avisan qué cartas todavía no tienen sus efectos programados.',
    'Cada carta indica qué parte de su texto el motor todavía no ejecuta, y un mazo con cartas así aparece como no jugable, con un mensaje corto. En el tablero se distinguen las utilidades que no se pueden jugar.\n\n' +
      'En esos días entraron también varias rondas de correcciones del diseñador y las cartas reimpresas.',
    ['/deck-builder', 'Ir al constructor'],
  ),
  item(
    '20261029-como-jugar',
    '2026-10-29',
    'Guía "Cómo jugar" y E1.1 en el simulador',
    'Una guía nueva explica la preparación, el turno, el combate, las cadenas y las habilidades clave, y ya puedes jugar con las cartas de E1.1.',
    '"Cómo jugar" recorre la preparación, el turno, el combate, los efectos y las cadenas, y lista las habilidades clave.\n\n' +
      'El motor sumó las cartas de E1.1, con reglas que confirmó el diseñador. Las elecciones muestran ahora dónde está cada carta, y puedes mover varias cartas en una sola acción.',
    ['/ruling', 'Leer la guía'],
  ),
  item(
    '20261028-motor',
    '2026-10-28',
    'El simulador aplica las reglas por ti',
    'El simulador tiene ahora un motor de reglas: invocaciones, cadenas, combate y efectos se resuelven solos según el reglamento.',
    'El motor maneja la invocación normal, la Evolución, el Ascenso, la Materialización y el Ritual, la cadena con sus eslabones, el combate con bloqueos y los efectos que se activan solos. Solo te pide elegir cuando hace falta.\n\n' +
      'Con él llegan programados los mazos de estructura ST1 a ST4. Además puedes crear salas o unirte a ellas, con una presala para elegir tu mazo antes de empezar.',
    SIMULATOR,
  ),
  item(
    '20261027-eras-2',
    '2026-10-27',
    'ERAS 2.0: una web renovada',
    'El sitio estrena un diseño nuevo, rehecho desde cero, con cartas, ediciones, mazos, tierlist y constructor.',
    'Toda la web se rehízo desde cero con un diseño nuevo, y ahora entras con tu cuenta. Trae filtros de cartas, mazos y tierlist con portadas en forma de carta, y el constructor de mazos renovado.\n\n' +
      'El simulador mantiene las partidas de dos jugadores, y es la base de todo lo que llegó después.',
    ['/cards', 'Ver las cartas'],
  ),
];
