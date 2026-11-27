export type RetreatReel = {
  id: string;
  title: string;
  caption: string;
};

export const retreatReels: [RetreatReel, ...RetreatReel[]] = [
  {
    id: 'cuerpo-en-movimiento',
    title: 'Cuerpo en movimiento',
    caption: 'Movimiento al aire libre y una ronda compartida.',
  },
  {
    id: 'caballos-y-fogon',
    title: 'Caballos y fogón',
    caption: 'Momentos con los caballos y un fogón entre los árboles.',
  },
  {
    id: 'casa-sabia',
    title: 'Casa Sabia y su entorno',
    caption: 'La casa, el paisaje y los caballos de Huerta Grande.',
  },
];
