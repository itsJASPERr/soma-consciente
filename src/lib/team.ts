import type { Aula } from './content';
import { yaninaWhatsApp } from './offerings';

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
  email: string;
  whatsapp?: string;
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
    email: 'nicole@soma-consciente.com',
    whatsapp: 'https://wa.me/34621076042',
    practice: 'Psicología y presencia',
    introduction: 'Aporta una mirada psicológica y corporal para reconocer lo que sentimos y respetar nuestros ritmos.',
    biography: 'Soy licenciada en Psicología y acompaño a personas adultas. Mi práctica se nutre de la Gestalt, la escucha del cuerpo y los ciclos de la naturaleza.',
    contribution: 'En SOMA comparto prácticas de respiración, movimiento y meditación para hacer una pausa, reconocer lo que sentimos y darle un lugar a lo vivido, cada quien a su ritmo.',
    symbol: 'heart',
    tone: 'sage',
    photo: {
      src: '/media/team/nicole-rosignoli-miranda.webp',
      alt: 'Retrato de Nicole Rosignoli Miranda.',
      width: 1152,
      height: 2048,
      position: 'center 40%',
    },
  },
  {
    id: 'yanina',
    shortName: 'Yanina',
    name: 'Yanina Noelia Landriel',
    email: 'yanina@soma-consciente.com',
    whatsapp: yaninaWhatsApp,
    practice: 'Cuerpo, movimiento y respiración',
    introduction: 'Invita a observar la respiración y explorar el movimiento desde su recorrido en kinesiología y osteopatía.',
    biography: 'Soy licenciada en Kinesiología y Fisioterapia y me formé en osteopatía. Mi recorrido profesional y mi búsqueda personal me llevaron a explorar cómo se relacionan el movimiento, el sistema nervioso y las emociones.',
    contribution: 'En SOMA comparto prácticas de movimiento y respiración para escuchar lo que el cuerpo nos pide y encontrar formas de cuidarnos en el día a día.',
    symbol: 'body',
    tone: 'earth',
    photo: {
      src: '/media/team/yanina-noelia-landriel.webp',
      alt: 'Yanina Noelia Landriel con sombrero y anteojos de sol entre los árboles.',
      width: 640,
      height: 640,
      position: 'center 22%',
    },
  },
  {
    id: 'nico-pacha',
    shortName: 'Nico Pacha',
    name: 'Nico Pacha',
    email: 'nico@soma-consciente.com',
    practice: 'Caballos y consciencia',
    introduction: 'Propone aprender del encuentro con los caballos, con atención a su lenguaje y al vínculo que se construye.',
    biography: 'En el encuentro con los caballos me interesa lo que podemos escuchar más allá de las palabras. Presto atención a cómo nos acercamos, qué expresamos con el cuerpo y cómo se construye la confianza.',
    contribution: 'En SOMA propongo experiencias para reconocer cómo nos vinculamos y llevar esa escucha a nuestras relaciones y a nuestra manera de estar en la naturaleza.',
    symbol: 'horse',
    tone: 'ochre',
    photo: {
      src: '/media/team/nico-pacha.webp',
      alt: 'Nico Pacha a caballo bajo la sombra de un árbol.',
      width: 720,
      height: 1280,
      position: 'center 8%',
    },
  },
  {
    id: 'jasper',
    shortName: 'Jasper',
    name: 'Jasper Meyer',
    email: 'jasper@soma-consciente.com',
    whatsapp: 'https://wa.me/543536569598',
    practice: 'Música, círculos e integración',
    introduction: 'Comparte música, escucha y círculos de palabra para darle continuidad a lo vivido después del encuentro.',
    biography: 'Construyo tambores y acompaño espacios de escucha e integración con la voz, el ritmo, el silencio y los círculos de palabra. Mi recorrido me acercó a saberes ancestrales y a proyectos de regeneración de la tierra.',
    contribution: 'En SOMA me interesa que lo que vivimos juntos encuentre un lugar en nuestras decisiones, nuestros vínculos y nuestra vida cotidiana.',
    symbol: 'sound',
    tone: 'clay',
    photo: {
      src: '/media/team/jasper-meyer.webp',
      alt: 'Jasper Meyer con los ojos cerrados y una guitarra entre el follaje.',
      width: 533,
      height: 947,
      position: 'center 27%',
    },
  },
];
