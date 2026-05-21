import { AiService } from '@ghostfolio/api/app/endpoints/ai/ai.service';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'child_process';
import { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<
    Pick<HealthService, 'isDatabaseHealthy' | 'isRedisCacheHealthy'>
  >;

  beforeEach(() => {
    healthService = {
      isDatabaseHealthy: jest.fn(),
      isRedisCacheHealthy: jest.fn()
    };

    controller = new HealthController(
      null,
      healthService as unknown as HealthService
    );
  });

  const createResponse = () => {
    const response = {
      json: jest.fn(),
      status: jest.fn()
    };

    response.json.mockReturnValue(response);
    response.status.mockReturnValue(response);

    return response;
  };

  const callReadinessDetails = async ({
    database,
    redis
  }: {
    database: boolean;
    redis: boolean;
  }) => {
    const response = createResponse();

    healthService.isDatabaseHealthy.mockResolvedValue(database);
    healthService.isRedisCacheHealthy.mockResolvedValue(redis);

    await controller.getReadinessDetails(response as unknown as Response);

    return {
      body: response.json.mock.calls[0][0],
      response
    };
  };

  it('returns detailed readiness when all dependencies are healthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-all-healthy,c-readiness-details-body-database-true-all-healthy,c-readiness-details-body-redis-true-all-healthy,c-readiness-details-body-status-ok-all-healthy,c-readiness-details-body-no-extra-fields
    const { body, response } = await callReadinessDetails({
      database: true,
      redis: true
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body).toEqual({
      database: true,
      redis: true,
      status: 'OK'
    });
    expect(Object.keys(body).sort()).toEqual(['database', 'redis', 'status']);
  });

  it('returns detailed readiness when the database is unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-db-unhealthy,c-readiness-details-body-database-false-db-unhealthy,c-readiness-details-body-status-unavailable-db-unhealthy
    const { body, response } = await callReadinessDetails({
      database: false,
      redis: true
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body.database).toBe(false);
    expect(body.redis).toBe(true);
    expect(body.status).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns detailed readiness when Redis is unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-redis-unhealthy,c-readiness-details-body-redis-false-redis-unhealthy,c-readiness-details-body-status-unavailable-redis-unhealthy
    const { body, response } = await callReadinessDetails({
      database: true,
      redis: false
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body.database).toBe(true);
    expect(body.redis).toBe(false);
    expect(body.status).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns detailed readiness when both dependencies are unhealthy', async () => {
    // harness:criterion=c-readiness-details-returns-200-both-unhealthy,c-readiness-details-body-both-false-both-unhealthy,c-readiness-details-body-status-unavailable-both-unhealthy
    const { body, response } = await callReadinessDetails({
      database: false,
      redis: false
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body.database).toBe(false);
    expect(body.redis).toBe(false);
    expect(body.status).toBe('SERVICE_UNAVAILABLE');
  });

  it('keeps the existing health endpoint unavailable when a dependency is unhealthy', async () => {
    // harness:criterion=c-existing-health-endpoint-unaffected
    const response = createResponse();

    healthService.isDatabaseHealthy.mockResolvedValue(false);
    healthService.isRedisCacheHealthy.mockResolvedValue(true);

    await controller.getHealth(response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE
    );
  });

  describe('HTTP readiness details response', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
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

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');

      await app.listen(0);
    });

    afterEach(async () => {
      await app.close();
    });

    it('responds with JSON and HTTP 200 without authentication', async () => {
      // harness:criterion=c-readiness-details-no-auth-required,c-readiness-details-body-is-json
      healthService.isDatabaseHealthy.mockResolvedValue(true);
      healthService.isRedisCacheHealthy.mockResolvedValue(true);

      const response = await fetch(
        `${await app.getUrl()}/api/health/readiness/details`
      );
      const body = await response.json();

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.headers.get('content-type')).toContain(
        'application/json'
      );
      expect(body).toEqual({
        database: true,
        redis: true,
        status: 'OK'
      });
    });
  });
});

describe('Health readiness details contract files', () => {
  const rootPath = process.cwd();
  const controllerPath = join(
    rootPath,
    'apps/api/src/app/health/health.controller.ts'
  );
  const healthServicePath = join(
    rootPath,
    'apps/api/src/app/health/health.service.ts'
  );
  const interfacePath = join(
    rootPath,
    'libs/common/src/lib/interfaces/responses/readiness-details-health-response.interface.ts'
  );
  const interfaceIndexPath = join(
    rootPath,
    'libs/common/src/lib/interfaces/index.ts'
  );

  const readSource = (path: string) => {
    return readFileSync(path, 'utf8');
  };

  const getMethodBody = (source: string, methodName: string) => {
    const methodStart = source.indexOf(`public async ${methodName}`);
    const bodyStart = source.indexOf('{', methodStart);
    let depth = 0;

    for (let index = bodyStart; index < source.length; index++) {
      if (source[index] === '{') {
        depth++;
      } else if (source[index] === '}') {
        depth--;
      }

      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }

    return '';
  };

  it('does not guard the readiness details controller method', () => {
    // harness:criterion=c-readiness-details-no-guard-decorator
    const source = readSource(controllerPath);
    const methodStart = source.indexOf('public async getReadinessDetails');
    const linesBeforeMethod = source.slice(0, methodStart).trimEnd().split('\n');
    const decoratorLines: string[] = [];

    for (let index = linesBeforeMethod.length - 1; index >= 0; index--) {
      const line = linesBeforeMethod[index].trim();

      if (line === '') {
        continue;
      }

      if (!line.startsWith('@')) {
        break;
      }

      decoratorLines.unshift(line);
    }

    expect(decoratorLines).not.toEqual(
      expect.arrayContaining([expect.stringContaining('@UseGuards')])
    );
  });

  it('uses the existing health service dependency checks', () => {
    // harness:criterion=c-readiness-details-uses-existing-db-check,c-readiness-details-uses-existing-redis-check
    const controllerSource = readSource(controllerPath);
    const healthServiceSource = readSource(healthServicePath);
    const methodBody = getMethodBody(controllerSource, 'getReadinessDetails');

    expect(methodBody.match(/isDatabaseHealthy/g) ?? []).toHaveLength(1);
    expect(methodBody.match(/isRedisCacheHealthy/g) ?? []).toHaveLength(1);

    const databaseOrRedisMethodNames = [
      ...healthServiceSource.matchAll(/public async ([A-Za-z0-9_]+)\(/g)
    ]
      .map((match) => {
        return match[1];
      })
      .filter((methodName) => {
        return /database|redis/i.test(methodName);
      })
      .sort();

    expect(databaseOrRedisMethodNames).toEqual([
      'isDatabaseHealthy',
      'isRedisCacheHealthy'
    ]);
  });

  it('defines and exports the shared readiness details response interface', () => {
    // harness:criterion=c-readiness-details-response-interface-exists,c-readiness-details-interface-exported
    expect(existsSync(interfacePath)).toBe(true);

    const interfaceSource = readSource(interfacePath);
    const interfaceIndexSource = readSource(interfaceIndexPath);

    expect(interfaceSource).toContain('database: boolean');
    expect(interfaceSource).toContain('redis: boolean');
    expect(interfaceSource).toContain(
      "status: 'OK' | 'SERVICE_UNAVAILABLE'"
    );
    expect(interfaceIndexSource).toContain('ReadinessDetailsHealthResponse');
  });

  it('does not include schema, migration, or module changes in this feature diff', () => {
    // harness:criterion=c-readiness-details-no-schema-migration,c-readiness-details-no-module-changes
    const changedFiles = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
      cwd: rootPath,
      encoding: 'utf8'
    })
      .split('\n')
      .filter(Boolean);

    expect(changedFiles).not.toContain('prisma/schema.prisma');
    expect(
      changedFiles.some((changedFile) => {
        return changedFile.startsWith('prisma/migrations/');
      })
    ).toBe(false);
    expect(changedFiles).not.toContain(
      'apps/api/src/app/health/health.module.ts'
    );
    expect(changedFiles).not.toContain('apps/api/src/app/app.module.ts');
  });
});
