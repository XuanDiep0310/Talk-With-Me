import { environment as productionEnvironment } from './environment.prod';

export const environment = {
  ...productionEnvironment,
  apiUrl: 'https://p01--backend-api--w8mz8twm78d4.code.run/api/v1'
};
