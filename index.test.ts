import axios from 'axios';
import * as ff from '@google-cloud/functions-framework';
import { InfluxDB } from '@influxdata/influxdb-client';

// mock to prevent unintended api calls
jest.mock('axios');
jest.mock('@influxdata/influxdb-client');
jest.mock('@google-cloud/functions-framework');
jest.mock('./queries', () => ({
  currentWeather: jest.fn().mockReturnValue('mock-current-query'),
  hourlyWeather: jest.fn().mockReturnValue('mock-hourly-query'),
  dailyWeather: jest.fn().mockReturnValue('mock-daily-query'),
  domeStatus: jest.fn().mockReturnValue('mock-dome-query'),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedInflux = InfluxDB as jest.MockedClass<typeof InfluxDB>;
const mockedFF = ff as jest.Mocked<typeof ff>;

describe('Summit Stats', () => {
  let mainHandler: (req: any, res: any) => Promise<void>;
  let queryRowsMock: jest.Mock;

  // Helpers
  // automatically creates req and res objects
  const createMockContext = (path: string) => {
    const req = { path };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
    return { req, res };
  };

  // Helper to simulate Influx Observer streaming
  const mockInfluxStream = (result: { data?: any[]; error?: Error }) => {
    queryRowsMock.mockImplementation((query, observer) => {
      if (result.error) {
        observer.error(result.error);
      } else if (result.data) {
        result.data.forEach((row) => {
          observer.next(row, { toObject: (r: any) => r });
        });
        observer.complete();
      }
    });
  };

  beforeAll(() => {
    // Intercept registration of handlers and save it as mainHandler
    mockedFF.http.mockImplementation((name, handler) => {
      mainHandler = handler;
    });

    // Isolate module loading to force trigger registration
    jest.isolateModules(() => {
      require('./index');
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { EFD_URL: 'mock', EFD_BUCKET: 'mock', EFD_TOKEN: 'mock' };
    
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Silence console.error during tests

    // Setup Influx Infrastructure
    queryRowsMock = jest.fn();
    mockedInflux.mockImplementation(() => ({
      getQueryApi: jest.fn().mockReturnValue({ queryRows: queryRowsMock }),
    } as any));
  });


  it('should return the cat emoji on root path', async () => {
    const { req, res } = createMockContext('/');
    await mainHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("🐈‍⬛");
  });

  it('should handle /dome-stats when dome is OPEN (>90)', async () => {
    const { req, res } = createMockContext('/dome-stats');

    mockInfluxStream({ data: [{ _value: 91.0 }, { _value: 95.0 }] });
    mockedAxios.post.mockResolvedValue({ data: { status: 'SUCCESS' } });

    await mainHandler(req, res);

    expect(queryRowsMock).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('dome-stats'),
      { dome: 'open' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ dome: 'open' });
  });

  test.each([
    ['/current-stats', 'current', { temp: 15, wind: 5 }],
    ['/hourly-stats', 'hourly', [{ temp: 15, wind: 5 }]],
    ['/daily-stats', 'daily', [{ day: 1 }]]
  ])('should handle %s success', async (path, key, mockData) => {
    const { req, res } = createMockContext(path);

    mockInfluxStream({ data: Array.isArray(mockData) ? mockData : [mockData] });
    mockedAxios.post.mockResolvedValue({ data: { status: 'SUCCESS' } });

    await mainHandler(req, res);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining(path.replace('/', '')), 
      { [key]: mockData }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test.each([
    // ['/current-stats', 'current'], # we had to return 500 due to reject() instead of resolve()
    ['/hourly-stats', 'hourly'],
    ['/daily-stats', 'daily']
  ])('should handle InfluxDB errors on %s', async (path, key) => {
    const { req, res } = createMockContext(path);
    const dbError = new Error("Some error");

    mockInfluxStream({ error: dbError }); // Simulate error

    await mainHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ [key]: dbError });
  });

  it('should handle Axios downstream errors', async () => {
    const { req, res } = createMockContext('/daily-stats');

    mockInfluxStream({ data: [{ some: 'data' }] });
    
    mockedAxios.post.mockRejectedValue({ 
      response: 'Server Error', 
      data: { error: 'Redis died' } 
    });

    await mainHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Redis died' });
  });
});