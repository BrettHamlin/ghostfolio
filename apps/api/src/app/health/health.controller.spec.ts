import 'reflect-metadata';

import { environment } from '@ghostfolio/api/environments/environment';
import type { ReadinessDetailsHealthResponse } from '@ghostfolio/common/interfaces';

import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA
} from '@nestjs/common/constants';
import type { Response } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

import { HealthController } from './health.controller';

function createResponseMock() {
  const response = {
    json: jest.fn(),
    status: jest.fn()
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
}

function getJsonBody<T>(response: { json: jest.Mock }) {
  return response.json.mock.calls[0][0] as T;
}

describe('HealthController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should expose readiness details through a public GET route', () => {
    const handler = HealthController.prototype.getReadinessDetails;

    //harness:criterion=c-readiness-details-route-path-metadata,c-readiness-details-route-method-metadata,c-readiness-details-no-auth-guard
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toEqual(
      'readiness/details'
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toEqual(
      RequestMethod.GET
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []).toEqual([]);
  });

  it('should return readiness details with the expected response body', () => {
    jest.spyOn(process, 'uptime').mockReturnValue(123.456);
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      arrayBuffers: 0,
      external: 0,
      heapTotal: 20_971_520,
      heapUsed: 10_485_760,
      rss: 31_457_280
    });

    const controller = new HealthController(null, null);
    const response = createResponseMock();

    controller.getReadinessDetails(response);

    const body: ReadinessDetailsHealthResponse =
      getJsonBody<ReadinessDetailsHealthResponse>(response);

    //harness:criterion=c-readiness-details-get-returns-200,c-readiness-details-uses-response-status-json-pattern
    expect(response.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(response.json).toHaveBeenCalledTimes(1);

    //harness:criterion=c-readiness-details-response-has-exactly-five-fields,c-readiness-details-interface-fields-typed,c-readiness-details-interface-exported-from-barrel
    expect(Object.keys(body).sort()).toEqual([
      'memoryUsageMb',
      'status',
      'timestamp',
      'uptimeSeconds',
      'version'
    ]);

    //harness:criterion=c-readiness-details-status-is-string
    expect(body.status).toEqual(getReasonPhrase(StatusCodes.OK));

    //harness:criterion=c-readiness-details-timestamp-is-iso-string
    expect(typeof body.timestamp).toEqual('string');
    expect(new Date(body.timestamp).toISOString()).toEqual(body.timestamp);

    //harness:criterion=c-readiness-details-uptime-is-number
    expect(body.uptimeSeconds).toEqual(123.456);
    expect(Number.isFinite(body.uptimeSeconds)).toEqual(true);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);

    //harness:criterion=c-readiness-details-memory-is-number,c-readiness-details-memory-mb-conversion
    expect(body.memoryUsageMb).toEqual(10);
    expect(Number.isFinite(body.memoryUsageMb)).toEqual(true);
    expect(body.memoryUsageMb).toBeGreaterThan(0);

    //harness:criterion=c-readiness-details-version-is-string
    expect(body.version).toEqual(environment.version);
    expect(typeof body.version).toEqual('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('should keep the existing health endpoint returning OK when dependencies are healthy', async () => {
    const controller = new HealthController(null, {
      isDatabaseHealthy: jest.fn().mockResolvedValue(true),
      isRedisCacheHealthy: jest.fn().mockResolvedValue(true)
    } as any);
    const response = createResponseMock();

    await controller.getHealth(response);

    //harness:criterion=c-readiness-details-existing-health-endpoint-unaffected
    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(response.json).toHaveBeenCalledWith({
      status: getReasonPhrase(StatusCodes.OK)
    });
  });
});
