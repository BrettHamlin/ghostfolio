import type { ReadinessDetailsHealthResponse } from '@ghostfolio/common/interfaces';

import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<
    Pick<HealthService, 'isDatabaseHealthy' | 'isRedisCacheHealthy'>
  >;
  let response: jest.Mocked<Pick<Response, 'json' | 'status'>>;

  beforeEach(() => {
    healthService = {
      isDatabaseHealthy: jest.fn(),
      isRedisCacheHealthy: jest.fn()
    };

    controller = new HealthController(null, healthService as HealthService);

    response = {
      json: jest.fn(),
      status: jest.fn()
    };

    response.status.mockReturnValue(response as Response);
    response.json.mockReturnValue(response as Response);
  });

  const expectReadinessResponse = ({
    expectedBody
  }: {
    expectedBody: ReadinessDetailsHealthResponse;
  }) => {
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith(expectedBody);

    const body = response.json.mock.calls[0][0];

    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    expect(Object.keys(body)).toHaveLength(3);
    expect(typeof body.database).toBe('boolean');
    expect(typeof body.redis).toBe('boolean');
    expect(typeof body.status).toBe('string');
    expect(healthService.isDatabaseHealthy).toHaveBeenCalledTimes(1);
    expect(healthService.isRedisCacheHealthy).toHaveBeenCalledTimes(1);
  };

  it('returns readiness details when database and Redis are healthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-all-healthy-body,c-readiness-details-status-ok-literal,c-readiness-details-no-auth-required,c-readiness-details-no-guards,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks,c-readiness-details-interface-fields,c-readiness-details-interface-exported
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );

    await controller.getReadinessDetails(response as Response);

    expectReadinessResponse({
      expectedBody: { database: true, redis: true, status: 'OK' }
    });
    expect(response.json.mock.calls[0][0].status).toBe('OK');
  });

  it('returns readiness details when the database is unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-db-unhealthy-body,c-readiness-details-status-service-unavailable-literal,c-readiness-details-no-auth-required,c-readiness-details-no-guards,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(false)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );

    await controller.getReadinessDetails(response as Response);

    expectReadinessResponse({
      expectedBody: {
        database: false,
        redis: true,
        status: 'SERVICE_UNAVAILABLE'
      }
    });
    expect(response.json.mock.calls[0][0].status).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns readiness details when Redis is unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-redis-unhealthy-body,c-readiness-details-status-service-unavailable-literal,c-readiness-details-no-auth-required,c-readiness-details-no-guards,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(false)
    );

    await controller.getReadinessDetails(response as Response);

    expectReadinessResponse({
      expectedBody: {
        database: true,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      }
    });
    expect(response.json.mock.calls[0][0].status).toBe('SERVICE_UNAVAILABLE');
  });
});
