export interface ReadinessDetailsHealthResponse {
  database: boolean;
  redis: boolean;
  status: 'OK' | 'SERVICE_UNAVAILABLE';
}
