import type { Environment } from './environment.model';

/** AWS: the site on CloudFront, the backend on a server that sleeps; /wake starts it (a Lambda behind CloudFront). */
export const environment: Environment = {
  apiBaseUrl: '',
  wakeUrl: '/wake',
};
