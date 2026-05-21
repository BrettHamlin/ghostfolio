export interface ReadinessDetailsResponse {
  database: boolean;
  redis: boolean;
  status: 'OK' | 'SERVICE_UNAVAILABLE';
}
