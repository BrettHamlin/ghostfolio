import type { ReadinessDetailsHealthResponse } from '@ghostfolio/common/interfaces';
import type { Response } from 'express';

import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA
} from '@nestjs/common/constants';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

type ExpectedReadinessDetailsHealthResponse = {
  database: boolean;
  redis: boolean;
  status: string;
};

type ExactReadinessDetailsHealthResponse =
  ReadinessDetailsHealthResponse extends ExpectedReadinessDetailsHealthResponse
    ? Exclude<
        keyof ReadinessDetailsHealthResponse,
        keyof ExpectedReadinessDetailsHealthResponse
      > extends never
      ? ExpectedReadinessDetailsHealthResponse extends ReadinessDetailsHealthResponse
        ? true
        : never
      : never
    : never;

const readinessDetailsHealthResponseInterfaceMatches: ExactReadinessDetailsHealthResponse =
  true;

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

    controller = new HealthController(
      null as unknown as ConstructorParameters<typeof HealthController>[0],
      healthService as unknown as HealthService
    );

    response = {
      json: jest.fn(),
      status: jest.fn()
    };

    response.status.mockReturnValue(response as unknown as Response);
    response.json.mockReturnValue(response as unknown as Response);
  });

  const expectReadinessResponse = ({
    expectedBody
  }: {
    expectedBody: ReadinessDetailsHealthResponse;
  }) => {
    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.status.mock.calls[0][0]).toBe(200);
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith(expectedBody);

    const body = response.json.mock.calls[0][0] as ReadinessDetailsHealthResponse;

    expect(body).toStrictEqual(expectedBody);
    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    expect(Object.keys(body)).toHaveLength(3);
    expect(typeof body.database).toBe('boolean');
    expect(typeof body.redis).toBe('boolean');
    expect(typeof body.status).toBe('string');
    expect(healthService.isDatabaseHealthy).toHaveBeenCalled();
    expect(healthService.isRedisCacheHealthy).toHaveBeenCalled();
    expect(healthService.isDatabaseHealthy).toHaveBeenCalledTimes(1);
    expect(healthService.isRedisCacheHealthy).toHaveBeenCalledTimes(1);
  };

  it('uses the public readiness details response interface shape', () => {
    // harness:criterion=c-readiness-details-interface-fields,c-readiness-details-interface-exported
    const body: ReadinessDetailsHealthResponse = {
      database: true,
      redis: true,
      status: 'OK'
    };

    expect(readinessDetailsHealthResponseInterfaceMatches).toBe(true);
    expect(body).toStrictEqual({ database: true, redis: true, status: 'OK' });
    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    expect(Object.keys(body)).toHaveLength(3);
    expect(typeof body.database).toBe('boolean');
    expect(typeof body.redis).toBe('boolean');
    expect(typeof body.status).toBe('string');
  });

  it('returns readiness details when database and Redis are healthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-all-healthy-body,c-readiness-details-status-ok-literal,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks,c-readiness-details-interface-fields,c-readiness-details-interface-exported
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );

    await controller.getReadinessDetails(response as unknown as Response);

    expectReadinessResponse({
      expectedBody: { database: true, redis: true, status: 'OK' }
    });
    expect(response.json.mock.calls[0][0].status).toBe('OK');
  });

  it('returns readiness details when the database is unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-db-unhealthy-body,c-readiness-details-status-service-unavailable-literal,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(false)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );

    await controller.getReadinessDetails(response as unknown as Response);

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
    // harness:criterion=c-readiness-details-returns-200-always,c-readiness-details-redis-unhealthy-body,c-readiness-details-status-service-unavailable-literal,c-readiness-details-response-shape,c-readiness-details-controller-handler-exists,c-readiness-details-calls-both-checks
    healthService.isDatabaseHealthy.mockImplementation(() =>
      Promise.resolve(true)
    );
    healthService.isRedisCacheHealthy.mockImplementation(() =>
      Promise.resolve(false)
    );

    await controller.getReadinessDetails(response as unknown as Response);

    expectReadinessResponse({
      expectedBody: {
        database: true,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      }
    });
    expect(response.json.mock.calls[0][0].status).toBe('SERVICE_UNAVAILABLE');
  });

  it('registers readiness details as an unauthenticated GET route', () => {
    // harness:criterion=c-readiness-details-no-auth-required,c-readiness-details-no-guards,c-readiness-details-controller-handler-exists,c-readiness-details-returns-200-always,c-readiness-details-response-shape
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
    expect(Reflect.getMetadata(GUARDS_METADATA, HealthController)).toBe(
      undefined
    );
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        HealthController.prototype.getReadinessDetails
      )
    ).toBe(undefined);
  });
});
