import { AiService } from '@ghostfolio/api/app/endpoints/ai/ai.service';
import type { ReadinessDetailsResponse } from '@ghostfolio/common/interfaces';

import {
  HttpStatus,
  RequestMethod,
  VersioningType,
  type INestApplication
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { readFileSync } from 'fs';
import 'reflect-metadata';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

class HealthServiceMock extends HealthService {
  public readonly isDatabaseHealthyMock = jest.fn<Promise<boolean>, []>();
  public readonly isRedisCacheHealthyMock = jest.fn<Promise<boolean>, []>();

  public constructor({
    databaseHealthy,
    redisHealthy
  }: {
    databaseHealthy: boolean;
    redisHealthy: boolean;
  }) {
    super({} as never, {} as never, {} as never, {} as never);

    this.isDatabaseHealthyMock.mockResolvedValue(databaseHealthy);
    this.isRedisCacheHealthyMock.mockResolvedValue(redisHealthy);
  }

  public override isDatabaseHealthy() {
    return this.isDatabaseHealthyMock();
  }

  public override isRedisCacheHealthy() {
    return this.isRedisCacheHealthyMock();
  }
}

type MockResponse = Response & {
  json: jest.Mock;
  status: jest.Mock;
};

const createHealthServiceMock = ({
  databaseHealthy,
  redisHealthy
}: {
  databaseHealthy: boolean;
  redisHealthy: boolean;
}): HealthServiceMock => {
  return new HealthServiceMock({ databaseHealthy, redisHealthy });
};

const createResponseMock = (): MockResponse => {
  const response = {
    json: jest.fn(),
    status: jest.fn()
  } as unknown as MockResponse;

  response.json.mockReturnValue(response);
  response.status.mockReturnValue(response);

  return response;
};

const createController = (healthService: HealthServiceMock) => {
  return new HealthController({} as AiService, healthService);
};

const assertReadinessDetails = async ({
  databaseHealthy,
  expectedBody,
  redisHealthy
}: {
  databaseHealthy: boolean;
  expectedBody: {
    database: ReadinessDetailsResponse['database'];
    redis: ReadinessDetailsResponse['redis'];
    status: ReadinessDetailsResponse['status'];
  };
  redisHealthy: boolean;
}) => {
  const healthService = createHealthServiceMock({
    databaseHealthy,
    redisHealthy
  });
  const controller = createController(healthService);
  const response = createResponseMock();

  await controller.getReadinessDetails(response);

  expect(healthService.isDatabaseHealthyMock).toHaveBeenCalledTimes(1);
  expect(healthService.isRedisCacheHealthyMock).toHaveBeenCalledTimes(1);
  expect(response.status).toHaveBeenCalledTimes(1);
  expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
  expect(response.status.mock.calls).toEqual([[HttpStatus.OK]]);
  expect(response.json).toHaveBeenCalledTimes(1);
  expect(response.json).toHaveBeenCalledWith(expectedBody);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      database: expect.any(Boolean),
      redis: expect.any(Boolean),
      status: expect.any(String)
    })
  );
};

describe('HealthController', () => {
  describe('getReadinessDetails', () => {
    //harness:criterion=c-readiness-details-returns-200-both-healthy,c-readiness-details-status-ok-both-healthy,c-readiness-details-body-database-boolean-true,c-readiness-details-body-redis-boolean-true,c-readiness-details-response-status-called-with-http-ok,c-readiness-details-response-json-called-with-full-shape
    it('returns HTTP 200 and OK details when database and redis are healthy', async () => {
      await assertReadinessDetails({
        databaseHealthy: true,
        expectedBody: {
          database: true,
          redis: true,
          status: 'OK'
        },
        redisHealthy: true
      });
    });

    //harness:criterion=c-readiness-details-returns-200-db-unhealthy,c-readiness-details-status-unavailable-db-unhealthy,c-readiness-details-body-database-boolean-false,c-readiness-details-body-redis-boolean-true,c-readiness-details-response-status-called-with-http-ok,c-readiness-details-response-json-called-with-full-shape
    it('returns HTTP 200 and unavailable details when the database is unhealthy', async () => {
      await assertReadinessDetails({
        databaseHealthy: false,
        expectedBody: {
          database: false,
          redis: true,
          status: 'SERVICE_UNAVAILABLE'
        },
        redisHealthy: true
      });
    });

    //harness:criterion=c-readiness-details-returns-200-redis-unhealthy,c-readiness-details-status-unavailable-redis-unhealthy,c-readiness-details-body-database-boolean-true,c-readiness-details-body-redis-boolean-false,c-readiness-details-response-status-called-with-http-ok,c-readiness-details-response-json-called-with-full-shape
    it('returns HTTP 200 and unavailable details when redis is unhealthy', async () => {
      await assertReadinessDetails({
        databaseHealthy: true,
        expectedBody: {
          database: true,
          redis: false,
          status: 'SERVICE_UNAVAILABLE'
        },
        redisHealthy: false
      });
    });

    //harness:criterion=c-readiness-details-returns-200-both-unhealthy,c-readiness-details-status-unavailable-db-unhealthy,c-readiness-details-status-unavailable-redis-unhealthy,c-readiness-details-status-unavailable-both-unhealthy,c-readiness-details-body-database-boolean-false,c-readiness-details-body-redis-boolean-false,c-readiness-details-response-status-called-with-http-ok,c-readiness-details-response-json-called-with-full-shape
    it('returns HTTP 200 and unavailable details when database and redis are unhealthy', async () => {
      await assertReadinessDetails({
        databaseHealthy: false,
        expectedBody: {
          database: false,
          redis: false,
          status: 'SERVICE_UNAVAILABLE'
        },
        redisHealthy: false
      });
    });

    //harness:criterion=c-readiness-details-no-auth-required
    it('returns HTTP 200 from the versioned API route without authentication', async () => {
      const healthService = createHealthServiceMock({
        databaseHealthy: true,
        redisHealthy: true
      });
      const moduleReference = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: AiService,
            useValue: {}
          },
          {
            provide: HealthService,
            useValue: healthService
          }
        ]
      }).compile();
      const app: INestApplication = moduleReference.createNestApplication();

      app.enableVersioning({
        defaultVersion: '1',
        type: VersioningType.URI
      });
      app.setGlobalPrefix('api');
      await app.listen(0, '127.0.0.1');

      try {
        const httpResponse = await fetch(
          `${await app.getUrl()}/api/v1/health/readiness/details`
        );

        expect(httpResponse.status).toBe(HttpStatus.OK);
      } finally {
        await app.close();
      }
    });

    //harness:criterion=c-readiness-details-route-registered
    it('registers a GET readiness details handler on the health controller', () => {
      const handler = HealthController.prototype.getReadinessDetails;

      expect(typeof handler).toBe('function');
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
        'readiness/details'
      );
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.GET
      );
    });
  });

  describe('getHealth', () => {
    //harness:criterion=c-readiness-details-does-not-affect-existing-gethealth
    it('continues to return HTTP 503 when a dependency is unhealthy', async () => {
      const healthService = createHealthServiceMock({
        databaseHealthy: false,
        redisHealthy: true
      });
      const controller = createController(healthService);
      const response = createResponseMock();

      await controller.getHealth(response);

      expect(response.status.mock.calls).toEqual([
        [HttpStatus.SERVICE_UNAVAILABLE]
      ]);
      expect(response.status).not.toHaveBeenCalledWith(HttpStatus.OK);
    });
  });

  describe('ReadinessDetailsResponse', () => {
    //harness:criterion=c-readiness-details-interface-file-exists
    it('declares the shared readiness details response shape', () => {
      const interfaceContents = readFileSync(
        'libs/common/src/lib/interfaces/responses/readiness-details-response.interface.ts',
        'utf8'
      );

      expect(interfaceContents).toContain(
        'interface ReadinessDetailsResponse'
      );
      expect(interfaceContents).toContain('database: boolean');
      expect(interfaceContents).toContain('redis: boolean');
      expect(interfaceContents).toContain(
        "status: 'OK' | 'SERVICE_UNAVAILABLE'"
      );
    });

    //harness:criterion=c-readiness-details-interface-exported-from-barrel
    it('exports the shared readiness details response from the interfaces barrel', () => {
      const barrelContents = readFileSync(
        'libs/common/src/lib/interfaces/index.ts',
        'utf8'
      );

      expect(barrelContents).toContain('ReadinessDetailsResponse');
      expect(barrelContents).toContain(
        './responses/readiness-details-response.interface'
      );
    });
  });
});
