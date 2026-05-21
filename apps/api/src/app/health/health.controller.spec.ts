import type { ReadinessDetailsResponse } from '@ghostfolio/common/interfaces';

import { INestApplication, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';

import { AiService } from '../endpoints/ai/ai.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

type MockResponse = Pick<Response, 'status' | 'json'>;

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: Pick<
    HealthService,
    'isDatabaseHealthy' | 'isRedisCacheHealthy'
  >;

  beforeEach(() => {
    healthService = {
      isDatabaseHealthy: jest.fn(),
      isRedisCacheHealthy: jest.fn()
    };

    controller = new HealthController(null, healthService as HealthService);
  });

  function createResponse() {
    const response: MockResponse = {
      json: jest.fn(),
      status: jest.fn()
    };

    jest.mocked(response.status).mockReturnValue(response as Response);

    return response;
  }

  async function callGetReadinessDetails({
    database,
    redis
  }: {
    database: boolean;
    redis: boolean;
  }) {
    jest.mocked(healthService.isDatabaseHealthy).mockResolvedValue(database);
    jest.mocked(healthService.isRedisCacheHealthy).mockResolvedValue(redis);

    const response = createResponse();

    await controller.getReadinessDetails(response as Response);

    const body = jest.mocked(response.json).mock.calls[0][0];

    expect(healthService.isDatabaseHealthy).toHaveBeenCalledTimes(1);
    expect(healthService.isRedisCacheHealthy).toHaveBeenCalledTimes(1);

    return { body, response };
  }

  describe('getHealth', () => {
    it('keeps the existing health endpoint status and response shape', async () => {
      // harness:criterion=c-existing-gethealth-unaffected
      jest.mocked(healthService.isDatabaseHealthy).mockResolvedValue(true);
      jest.mocked(healthService.isRedisCacheHealthy).mockResolvedValue(true);

      const response = createResponse();

      await controller.getHealth(response as Response);

      const body = jest.mocked(response.json).mock.calls[0][0];

      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(body).toEqual({ status: 'OK' });
      expect(Object.keys(body)).toEqual(['status']);
    });
  });

  describe('getReadinessDetails', () => {
    it('returns OK details when database and redis are healthy', async () => {
      // harness:criterion=c-readiness-details-both-healthy-ok,c-readiness-details-status-field-values,c-readiness-details-no-extra-fields,c-readiness-details-uses-express-response-pattern,c-readiness-details-response-interface-exists,c-readiness-details-interface-exported,c-readiness-details-spec-file-collocated
      const expectedBody: ReadinessDetailsResponse = {
        database: true,
        redis: true,
        status: 'OK'
      };
      const { body, response } = await callGetReadinessDetails({
        database: true,
        redis: true
      });

      expect(response.status).toHaveBeenCalledTimes(1);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(body).toEqual(expectedBody);
      expect(body.status).toBe('OK');
      expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    });

    it('returns unavailable details when the database is unhealthy', async () => {
      // harness:criterion=c-readiness-details-db-unhealthy-unavailable,c-readiness-details-status-field-values,c-readiness-details-no-extra-fields,c-readiness-details-uses-express-response-pattern,c-readiness-details-spec-file-collocated
      const { body, response } = await callGetReadinessDetails({
        database: false,
        redis: true
      });

      expect(response.status).toHaveBeenCalledTimes(1);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(body).toEqual({
        database: false,
        redis: true,
        status: 'SERVICE_UNAVAILABLE'
      });
      expect(body.status).toBe('SERVICE_UNAVAILABLE');
      expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    });

    it('returns unavailable details when redis is unhealthy', async () => {
      // harness:criterion=c-readiness-details-redis-unhealthy-unavailable,c-readiness-details-status-field-values,c-readiness-details-no-extra-fields,c-readiness-details-uses-express-response-pattern,c-readiness-details-spec-file-collocated
      const { body, response } = await callGetReadinessDetails({
        database: true,
        redis: false
      });

      expect(response.status).toHaveBeenCalledTimes(1);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(body).toEqual({
        database: true,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      });
      expect(body.status).toBe('SERVICE_UNAVAILABLE');
      expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    });

    it('returns unavailable details with HTTP 200 when both checks are unhealthy', async () => {
      // harness:criterion=c-readiness-details-returns-200,c-readiness-details-both-unhealthy-unavailable,c-readiness-details-status-field-values,c-readiness-details-no-extra-fields,c-readiness-details-uses-express-response-pattern,c-readiness-details-no-service-changes,c-readiness-details-spec-file-collocated
      const { body, response } = await callGetReadinessDetails({
        database: false,
        redis: false
      });

      expect(response.status).toHaveBeenCalledTimes(1);
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledTimes(1);
      expect(body).toEqual({
        database: false,
        redis: false,
        status: 'SERVICE_UNAVAILABLE'
      });
      expect(body.status).toBe('SERVICE_UNAVAILABLE');
      expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
    });
  });
});

describe('HealthController readiness details route', () => {
  let app: INestApplication;
  let healthService: Pick<
    HealthService,
    'isDatabaseHealthy' | 'isRedisCacheHealthy'
  >;

  beforeEach(async () => {
    healthService = {
      isDatabaseHealthy: jest.fn().mockResolvedValue(false),
      isRedisCacheHealthy: jest.fn().mockResolvedValue(false)
    };

    const module: TestingModule = await Test.createTestingModule({
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

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  async function getReadinessDetails() {
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;

    return fetch(`http://127.0.0.1:${port}/api/health/readiness/details`);
  }

  it('serves the registered readiness details route publicly as JSON', async () => {
    // harness:criterion=c-readiness-details-returns-200,c-readiness-details-no-auth-guard,c-readiness-details-route-registered,c-readiness-details-json-content-type,c-readiness-details-no-extra-fields
    const response = await getReadinessDetails();
    const body = await response.json();

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.status).not.toBe(HttpStatus.UNAUTHORIZED);
    expect(response.status).not.toBe(HttpStatus.FORBIDDEN);
    expect(response.status).not.toBe(HttpStatus.NOT_FOUND);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toEqual({
      database: false,
      redis: false,
      status: 'SERVICE_UNAVAILABLE'
    });
    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
  });
});
