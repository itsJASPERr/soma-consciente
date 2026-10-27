export interface Aula {
  slug: string;
  name: string;
  shortName: string;
  guide: string;
  qualification: string;
  theme: 'terra' | 'azul' | 'oro' | 'verde';
  symbol: 'heart' | 'sound' | 'horse' | 'body';
  summary: string;
  description: string;
  approach: string;
  practices: string[];
  invitation: string;
}

export const aulas: Aula[] = [
  {
    slug: 'nicole',
    name: 'Psicología y presencia',
    shortName: 'Aula de Psicología',
    guide: 'Nicole Rosignoli Miranda',
    qualification: 'Licenciada en Psicología',
    theme: 'terra',
    symbol: 'heart',
    summary: 'Emoción, escucha corporal y procesos de integración.',
    description: 'Una invitación a escuchar el cuerpo, reconocer las emociones y encontrar maneras más conscientes de habitar la experiencia.',
    approach: 'Nicole reúne una perspectiva psicológica integral, con influencias de la Gestalt, la salud cíclica, la meditación y la escucha corporal. El cuidado y el respeto por el ritmo de cada persona son centrales.',
    practices: ['Escucha emocional y corporal', 'Respiración y meditación', 'Herramientas de autoconocimiento', 'Preparación e integración responsable de experiencias'],
    invitation: 'La integración comienza cuando podemos reconocer lo vivido y darle un lugar en nuestra vida cotidiana.'
  },
  {
    slug: 'jasper',
    name: 'Música, círculos e integración',
    shortName: 'Aula de Integración',
    guide: 'Jasper Meyer',
    qualification: 'Música medicina · Círculos de palabra · Acompañamiento',
    theme: 'azul',
    symbol: 'sound',
    summary: 'Sonido, escucha, consciencia y encuentro en comunidad.',
    description: 'Exploramos cómo la música, el silencio, el ritmo y la palabra pueden abrir espacios de presencia y reflexión.',
    approach: 'Jasper conecta prácticas de integración, música medicina, acompañamiento personal, artes ceremoniales y una relación cuidadosa entre conocimientos ancestrales y perspectivas contemporáneas.',
    practices: ['Música, ritmo y expresión', 'Círculos de palabra y escucha', 'Integración de experiencias significativas', 'Conexión con naturaleza y comunidad'],
    invitation: 'Un puente entre lo que experimentamos y la manera en que elegimos vivir.'
  },
  {
    slug: 'nico',
    name: 'Caballos y consciencia',
    shortName: 'Aula de Caballos',
    guide: 'Nico Pacha',
    qualification: 'Encuentros con caballos · Autoconocimiento',
    theme: 'oro',
    symbol: 'horse',
    summary: 'Vínculo, encuentro y expansión de consciencia junto a los caballos.',
    description: 'Un camino de descubrimiento personal en relación con los caballos y con aquello que aparece en el encuentro.',
    approach: 'Desde su propia experiencia, Nico desea acompañar a otras personas a encontrarse, ordenarse y expandirse. Cree en el trabajo en equipo como una forma de contribuir al crecimiento individual y colectivo.',
    practices: ['Encuentro y vínculo con caballos', 'Observación y autoconocimiento', 'Presencia y conexión', 'Reflexión desde la experiencia'],
    invitation: 'Formar equipo es también crecer y aportar nuestro granito de arena.'
  },
  {
    slug: 'yanina',
    name: 'Cuerpo y movimiento',
    shortName: 'Aula del Cuerpo',
    guide: 'Yanina Noelia Landriel',
    qualification: 'Lic. en Kinesiología y Fisioterapia · Osteopatía',
    theme: 'verde',
    symbol: 'body',
    summary: 'Osteopatía, movimiento y una mirada integral del cuerpo.',
    description: 'Un espacio para acercarnos al cuerpo desde el movimiento, la percepción y el cuidado.',
    approach: 'Yanina integra su trayectoria en kinesiología, fisioterapia, osteopatía y terapia postural activa con una búsqueda personal de autoconocimiento y una visión amplia de la salud.',
    practices: ['Conciencia corporal', 'Movimiento y postura', 'Conocimiento del cuerpo', 'Mirada integral del bienestar'],
    invitation: 'Comprender el cuerpo puede abrir nuevas preguntas sobre cómo habitamos nuestra vida.'
  }
];

export interface Resource {
  slug: string;
  category: string;
  title: string;
  summary: string;
  duration: string;
  introduction: string;
  sections: { heading: string; body: string }[];
  reflection: string;
}

export const resources: Resource[] = [
  {
    slug: 'primeros-pasos-meditacion',
    category: 'Práctica guiada',
    title: 'Meditación: primeros pasos',
    summary: 'Una práctica breve para volver al momento presente, sin exigencias ni resultados esperados.',
    duration: '5 minutos',
    introduction: 'Meditar no requiere dejar la mente en blanco. Podemos comenzar aprendiendo a observar lo que ocurre, con curiosidad y sin juicio.',
    sections: [
      { heading: 'Prepará tu espacio', body: 'Buscá un lugar donde puedas estar unos minutos sin interrupciones. Sentate de forma cómoda y estable. Podés dejar los ojos abiertos con una mirada suave o cerrarlos si te resulta agradable.' },
      { heading: 'Percibí tu respiración', body: 'Notá el aire al entrar y salir. No hace falta cambiar su ritmo. Sentí los puntos de contacto de tu cuerpo con la silla o el suelo.' },
      { heading: 'Volvé con amabilidad', body: 'Cuando aparezcan pensamientos, sonidos o sensaciones, reconocelos. No hay nada que corregir. Podés regresar suavemente a la respiración cuantas veces necesites.' },
      { heading: 'Cerrá la práctica', body: 'Antes de moverte, observá cómo estás. ¿Qué cambió, si es que cambió algo? Llevá esa observación a una acción pequeña de tu día.' }
    ],
    reflection: 'No hay una experiencia correcta. La práctica es volver a prestar atención.'
  },
  {
    slug: 'pausa-de-presencia',
    category: 'Ejercicio cotidiano',
    title: 'Una pausa de presencia',
    summary: 'Tres preguntas sencillas para volver a escucharte en medio del día.',
    duration: '3 minutos',
    introduction: 'Una pausa breve puede crear espacio entre el estímulo y nuestra respuesta. Esta propuesta no busca producir un estado especial.',
    sections: [
      { heading: 'Detenerse', body: 'Si podés, dejá a un lado lo que estás haciendo durante unos instantes. Registrá el contacto de tus pies con el suelo y tu entorno inmediato.' },
      { heading: 'Escucharse', body: 'Preguntate con sencillez: ¿qué percibo en mi cuerpo?, ¿qué emoción reconozco?, ¿qué necesito ahora? No hace falta encontrar respuestas completas.' },
      { heading: 'Elegir', body: 'Identificá una acción pequeña, realista y cuidadosa que pueda responder a lo que registraste. A veces esa acción es descansar, conversar o seguir con más claridad.' }
    ],
    reflection: 'La presencia también se cultiva en los momentos ordinarios.'
  },
  {
    slug: 'diario-de-integracion',
    category: 'Reflexión',
    title: 'Diario de integración',
    summary: 'Una forma sencilla de conectar experiencias significativas con decisiones cotidianas.',
    duration: '10 minutos',
    introduction: 'Integrar no es encontrar una interpretación definitiva. Es acercarnos a lo que vivimos, reconocer su contexto y explorar qué lugar tiene en la vida diaria.',
    sections: [
      { heading: 'Describir', body: 'Escribí lo que recordás de la experiencia sin apresurarte a explicar su significado. ¿Qué sucedió? ¿Qué sensaciones o emociones estuvieron presentes?' },
      { heading: 'Distinguir', body: 'Separá aquello que sentiste de las conclusiones que construís sobre ello. Podés sostener una pregunta abierta sin convertirla inmediatamente en una certeza.' },
      { heading: 'Relacionar', body: '¿Cómo dialoga esta experiencia con tus vínculos, límites, deseos y responsabilidades actuales? ¿Con quién sería útil conversar sobre lo vivido?' },
      { heading: 'Dar continuidad', body: 'Elegí una acción pequeña que puedas revisar con el tiempo. Las transformaciones sostenibles suelen necesitar contexto, paciencia y apoyo.' }
    ],
    reflection: 'Una experiencia significativa puede acompañarnos sin determinar por completo quiénes somos.'
  }
];
