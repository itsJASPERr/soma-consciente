import type { Aula } from './content';

export type TeamPhoto = {
  src: string;
  alt: string;
  width: number;
  height: number;
  position?: string;
};

export type TeamTone = 'sage' | 'earth' | 'ochre' | 'clay';

type TeamMember = {
  id: string;
  shortName: string;
  name: string;
  practice: string;
  introduction: string;
  biography: string;
  contribution: string;
  symbol: Aula['symbol'];
  tone: TeamTone;
  photo: TeamPhoto;
};

export const teamMembers: TeamMember[] = [
  {
    id: 'nicole',
    shortName: 'Nicole',
    name: 'Nicole Rosignoli Miranda',
    practice: 'Psicología y presencia',
    introduction: 'Aporta una mirada psicológica y corporal para reconocer lo que sentimos y respetar nuestros ritmos.',
    biography: 'Nicole es licenciada en Psicología. Su práctica con personas adultas se nutre de la Gestalt, la escucha corporal y la salud cíclica. También impulsa Naturaleza Viva, donde explora cómo los ritmos del cuerpo dialogan con la naturaleza.',
    contribution: 'En SOMA propone espacios para reconocer las emociones y necesidades propias. Además de la conversación, recurre al silencio, la meditación y el movimiento consciente para dar lugar a lo que cada persona está viviendo.',
    symbol: 'heart',
    tone: 'sage',
    photo: {
      src: '/media/team/ronda-entre-arboles.webp',
      alt: 'Personas sentadas en ronda entre los árboles durante un encuentro de SOMA.',
      width: 628,
      height: 1120,
      position: 'center 53%',
    },
  },
  {
    id: 'yanina',
    shortName: 'Yanina',
    name: 'Yanina Noelia Landriel',
    practice: 'Cuerpo, movimiento y respiración',
    introduction: 'Invita a observar la respiración y explorar el movimiento desde su recorrido en kinesiología y osteopatía.',
    biography: 'Yanina es licenciada en Kinesiología y Fisioterapia y se formó en osteopatía y terapia postural activa. Su recorrido empezó con el estudio del movimiento y se amplió hacia la relación entre el cuerpo, el sistema nervioso y las emociones.',
    contribution: 'En SOMA diseña propuestas para prestar atención a cómo respiramos, cómo nos movemos y qué señales nos da el cuerpo. Aporta también su interés en reunir saberes de distintas disciplinas y convertirlos en prácticas que podamos explorar juntos.',
    symbol: 'body',
    tone: 'earth',
    photo: {
      src: '/media/team/practica-corporal.webp',
      alt: 'Detalle de unas manos apoyadas sobre la espalda de una persona.',
      width: 900,
      height: 601,
      position: 'center 50%',
    },
  },
  {
    id: 'nico-pacha',
    shortName: 'Nico Pacha',
    name: 'Nico Pacha',
    practice: 'Caballos y consciencia',
    introduction: 'Propone aprender del encuentro con los caballos, con atención a su lenguaje y al vínculo que se construye.',
    biography: 'Desde Tierra Pacha Ecocentro, Nico propone experiencias de aprendizaje junto a los caballos. Su punto de partida es observar cómo nos acercamos, qué comunica el animal y cómo cambia la relación cuando hay tiempo para escucharlo.',
    contribution: 'En SOMA aporta una práctica de presencia y vínculo en la naturaleza. La observación del lenguaje no verbal, la confianza y el respeto por el caballo permiten explorar maneras de relacionarnos que también podemos llevar a lo cotidiano.',
    symbol: 'horse',
    tone: 'ochre',
    photo: {
      src: '/media/team/caballo-en-el-campo.webp',
      alt: 'Caballo en un claro del campo durante una actividad al aire libre.',
      width: 630,
      height: 1120,
      position: '60% center',
    },
  },
  {
    id: 'jasper',
    shortName: 'Jasper',
    name: 'Jasper Meyer',
    practice: 'Música, círculos e integración',
    introduction: 'Comparte música, escucha y círculos de palabra para darle continuidad a lo vivido después del encuentro.',
    biography: 'Jasper combina la música y la construcción artesanal de tambores con su participación en proyectos de regeneración vinculados a la tierra y la comunidad. En la voz, el ritmo y el silencio encontró maneras de acompañar experiencias que a veces cuesta poner en palabras.',
    contribution: 'En SOMA propone espacios de escucha a través del sonido y los círculos de palabra. Le interesa que lo vivido en un encuentro tenga continuidad en las conversaciones, los vínculos y las decisiones de todos los días.',
    symbol: 'sound',
    tone: 'clay',
    photo: {
      src: '/media/team/tambor-artesanal.webp',
      alt: 'Detalle de manos tocando un tambor artesanal.',
      width: 1120,
      height: 747,
      position: 'center 53%',
    },
  },
];
