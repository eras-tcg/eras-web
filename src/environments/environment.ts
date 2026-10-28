import type { Environment } from './environment.model';

/** Local development (`ng serve`): the API is proxied to staging by proxy.conf.json. */
export const environment: Environment = {
  apiBaseUrl: '',
};
