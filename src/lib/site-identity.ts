export const somaName = 'SOMA CONSCIENTE';
export const somaInstagram = 'https://www.instagram.com/soma.consciente.ar/';

export function somaOrganizationId(site: URL | undefined) {
  return new URL('/#organizacion', site).href;
}
