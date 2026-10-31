import { RacesService } from './races.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Race registration deadline', () => {
  const now = new Date('2026-10-31T05:00:00.000Z');
  const deadlineMs = 3 * 86400000;
  const create = jest.fn().mockResolvedValue({ id: 'entry' });
  const findRace = jest.fn();
  const service = new RacesService({
    race: { findUnique: findRace },
    horse: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'horse',
        name: 'Racer',
        locked: false,
        status: 'ACTIVE',
        healthStatus: 'FIT',
      }),
    },
    raceEntry: { findUnique: jest.fn().mockResolvedValue(null), create },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    create.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it.each([0, 1])(
    'accepts registration at least 72 hours before the race (+%s ms)',
    async (extra) => {
      findRace.mockResolvedValue({
        id: 'race',
        date: new Date(now.getTime() + deadlineMs + extra),
      });
      await expect(
        service.addEntry('race', { horseId: 'horse' }),
      ).resolves.toEqual({ id: 'entry' });
    },
  );

  it('rejects registration one millisecond after the deadline', async () => {
    findRace.mockResolvedValue({
      id: 'race',
      date: new Date(now.getTime() + deadlineMs - 1),
    });
    await expect(
      service.addEntry('race', { horseId: 'horse' }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
