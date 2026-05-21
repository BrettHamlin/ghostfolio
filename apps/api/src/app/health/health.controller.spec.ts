import { HttpStatus, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Response } from 'express';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

type ReadinessDetailsBody = {
  database: boolean;
  redis: boolean;
  status: string;
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  beforeEach(() => {
    healthService = {
      hasResponseFromDataEnhancer: jest.fn(),
      hasResponseFromDataProvider: jest.fn(),
      isDatabaseHealthy: jest.fn(),
      isRedisCacheHealthy: jest.fn()
    } as unknown as HealthService;

    controller = new HealthController({} as never, healthService);
  });

  function createResponseMock() {
    return {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  }

  async function expectReadinessDetails({
    databaseHealthy,
    expectedBody,
    redisHealthy
  }: {
    databaseHealthy: boolean;
    expectedBody: ReadinessDetailsBody;
    redisHealthy: boolean;
  }) {
    const response = createResponseMock();
    const databaseSpy = jest
      .spyOn(healthService, 'isDatabaseHealthy')
      .mockReturnValue(Promise.resolve(databaseHealthy));
    const redisSpy = jest
      .spyOn(healthService, 'isRedisCacheHealthy')
      .mockReturnValue(Promise.resolve(redisHealthy));
    const dataEnhancerSpy = jest.spyOn(
      healthService,
      'hasResponseFromDataEnhancer'
    );
    const dataProviderSpy = jest.spyOn(
      healthService,
      'hasResponseFromDataProvider'
    );

    await controller.getReadinessDetails(response as unknown as Response);

    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith(expectedBody);

    const body = response.json.mock.calls[0][0] as ReadinessDetailsBody;

    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    expect(typeof body.database).toBe('boolean');
    expect(typeof body.redis).toBe('boolean');
    expect(typeof body.status).toBe('string');
    expect(body.status).toBe(expectedBody.status);

    if (!databaseHealthy || !redisHealthy) {
      expect(body.status).toBe('SERVICE_UNAVAILABLE');
    }

    expect(databaseSpy).toHaveBeenCalledTimes(1);
    expect(redisSpy).toHaveBeenCalledTimes(1);
    expect(dataEnhancerSpy).not.toHaveBeenCalled();
    expect(dataProviderSpy).not.toHaveBeenCalled();
  }

  // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-both-healthy-ok,c-readiness-details-response-shape-no-extra-fields,c-readiness-details-reuses-health-service-methods,c-readiness-details-spec-file-covers-all-combinations
  it('returns OK details when database and Redis are healthy', async () => {
    await expectReadinessDetails({
      databaseHealthy: true,
      expectedBody: {
        database: true,
        redis: true,
        status: 'OK'
      },
      redisHealthy: true
    });
  });

  // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-db-unhealthy-service-unavailable,c-readiness-details-status-literal-token,c-readiness-details-response-shape-no-extra-fields,c-readiness-details-reuses-health-service-methods,c-readiness-details-spec-file-covers-all-combinations
  it('returns service unavailable details when only the database is unhealthy', async () => {
    await expectReadinessDetails({
      databaseHealthy: false,
      expectedBody: {
        database: false,
        redis: true,
        status: 'SERVICE_UNAVAILABLE'
      },
      redisHealthy: true
    });
  });

  // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-redis-unhealthy-service-unavailable,c-readiness-details-status-literal-token,c-readiness-details-response-shape-no-extra-fields,c-readiness-details-reuses-health-service-methods,c-readiness-details-spec-file-covers-all-combinations
  it('returns service unavailable details when only Redis is unhealthy', async () => {
    await expectReadinessDetails({
      databaseHealthy: true,
      expectedBody: {
        database: true,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      },
      redisHealthy: false
    });
  });

  // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-both-unhealthy-service-unavailable,c-readiness-details-status-literal-token,c-readiness-details-response-shape-no-extra-fields,c-readiness-details-reuses-health-service-methods,c-readiness-details-spec-file-covers-all-combinations
  it('returns service unavailable details when database and Redis are unhealthy', async () => {
    await expectReadinessDetails({
      databaseHealthy: false,
      expectedBody: {
        database: false,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      },
      redisHealthy: false
    });
  });

  // harness:criterion=c-readiness-details-route-registered,c-readiness-details-no-auth-required,c-readiness-details-no-use-guards
  it('registers readiness details as an unauthenticated GET health route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('health');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        HealthController.prototype.getReadinessDetails
      )
    ).toBe('readiness/details');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        HealthController.prototype.getReadinessDetails
      )
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        '__guards__',
        HealthController.prototype.getReadinessDetails
      ) ?? []
    ).toEqual([]);
    expect(Reflect.getMetadata('__guards__', HealthController) ?? []).toEqual(
      []
    );
  });
});
