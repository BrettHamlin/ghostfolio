import 'reflect-metadata';

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

type ResponseMock = Response & {
  json: jest.Mock;
  status: jest.Mock;
};

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: Pick<
    HealthService,
    'isDatabaseHealthy' | 'isRedisCacheHealthy'
  >;

  const createResponseMock = () => {
    const response = {
      json: jest.fn(),
      status: jest.fn()
    } as unknown as ResponseMock;

    response.json.mockReturnValue(response);
    response.status.mockReturnValue(response);

    return response;
  };

  const expectReadinessDetails = async ({
    databaseHealthy,
    expectedBody,
    redisHealthy
  }: {
    databaseHealthy: boolean;
    expectedBody: { database: boolean; redis: boolean; status: string };
    redisHealthy: boolean;
  }) => {
    const response = createResponseMock();

    (healthService.isDatabaseHealthy as jest.Mock).mockResolvedValue(
      databaseHealthy
    );
    (healthService.isRedisCacheHealthy as jest.Mock).mockResolvedValue(
      redisHealthy
    );

    await controller.getReadinessDetails(response);

    expect(response.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(response.json).toHaveBeenCalledWith(expectedBody);
  };

  const reflectMetadata = Reflect as unknown as {
    getMetadata: (metadataKey: string, target: object) => unknown;
  };

  beforeEach(() => {
    healthService = {
      isDatabaseHealthy: jest.fn(),
      isRedisCacheHealthy: jest.fn()
    };

    controller = new HealthController(null, healthService as HealthService);
  });

  //harness:criterion=c-readiness-details-returns-200-both-healthy,c-readiness-details-body-ok-both-healthy,c-readiness-details-no-auth-guard,c-readiness-details-existing-health-endpoint-unaffected,c-readiness-details-controller-spec-covers-all-four-combinations
  it('returns readiness details when the database and Redis are healthy', async () => {
    await expectReadinessDetails({
      databaseHealthy: true,
      expectedBody: { database: true, redis: true, status: 'OK' },
      redisHealthy: true
    });

    expect(
      reflectMetadata.getMetadata(
        GUARDS_METADATA,
        HealthController.prototype.getReadinessDetails
      )
    ).toBeUndefined();
    expect(
      reflectMetadata.getMetadata(GUARDS_METADATA, HealthController)
    ).toBeUndefined();

    const response = createResponseMock();

    (healthService.isDatabaseHealthy as jest.Mock).mockResolvedValue(true);
    (healthService.isRedisCacheHealthy as jest.Mock).mockResolvedValue(true);

    await controller.getHealth(response);

    expect(response.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(response.json).toHaveBeenCalledWith({ status: 'OK' });
  });

  //harness:criterion=c-readiness-details-returns-200-db-unhealthy,c-readiness-details-body-service-unavailable-db-unhealthy,c-readiness-details-controller-spec-covers-all-four-combinations
  it('returns readiness details when only the database is unhealthy', async () => {
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

  //harness:criterion=c-readiness-details-returns-200-redis-unhealthy,c-readiness-details-body-service-unavailable-redis-unhealthy,c-readiness-details-controller-spec-covers-all-four-combinations
  it('returns readiness details when only Redis is unhealthy', async () => {
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

  //harness:criterion=c-readiness-details-returns-200-both-unhealthy,c-readiness-details-body-service-unavailable-both-unhealthy,c-readiness-details-controller-spec-covers-all-four-combinations
  it('returns readiness details when the database and Redis are unhealthy', async () => {
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
});
