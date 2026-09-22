export interface AppHealth {
  app_name: string;
  version: string;
  environment: string;
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy';
  latency_ms?: number;
  details?: string;
  timestamp: string;
}

export interface OverallSystemHealth {
  app: AppHealth | null;
  database: ServiceHealth | null;
  redis: ServiceHealth | null;
  isLoading: boolean;
  error?: string | null;
  lastChecked?: Date;
}
