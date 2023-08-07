import 'dotenv/config'
import * as ff from '@google-cloud/functions-framework';
import { InfluxDB } from "@influxdata/influxdb-client";
import { currentWeather, hourlyWeather, dailyWeather } from "./queries";
import axios from "axios";

interface currentWeatherI {
    current: [any];
}
interface hourlyWeatherI {
    hourly: [any];
}
interface dailyWeatherI {
    daily: [any];
}

const types = {
    current: currentWeather,
    hourly: hourlyWeather,
    daily: dailyWeather,
  };

ff.http('summit-stats', async (req: ff.Request, res: ff.Response) => {
    const url:string = String(process.env.EFD_URL);
    const bucket:string = String(process.env.EFD_BUCKET);
    const token:string = String(process.env.EFD_TOKEN);
    const timeout:number = 30000;

    const influxDB = new InfluxDB({ url, token });
    const influxDB2 = new InfluxDB({ url, token });
    const influxDB3 = new InfluxDB({ url, token, timeout });
    const queryApi = influxDB.getQueryApi("");
    const queryApi2 = influxDB2.getQueryApi("");
    const queryApi3 = influxDB3.getQueryApi("");

    Promise.all(
        [ 
            // Current values
            new Promise((resolve, reject) => {
                let type = "current";
                let test:any = type;
                const query = types[test as keyof Object];
                const data:any = [];
                queryApi.queryRows(query(bucket), {
                    next(row, tableMeta) {
                        data.push(tableMeta.toObject(row));
                    },
                    error(error) {
                        resolve({ [type]: error })
                    },
                    complete() {
                        resolve({ [type]: data })
                    },
                });
            }),
            // Hourly values
            new Promise((resolve, reject) => {
                let type = "hourly";
                let test:any = type;
                const query = types[test as keyof Object];
                const data:any = [];
                queryApi2.queryRows(query(bucket), {
                    next(row, tableMeta) {
                        data.push(tableMeta.toObject(row));
                    },
                    error(error) {
                        resolve({ [type]: error })
                    },
                    complete() {
                        resolve({ [type]: data })
                    },
                });
            }),
            // Daily values
            new Promise((resolve, reject) => {
                let type = "daily";
                let test:any = type;
                const query = types[test as keyof Object];
                const data:any = [];
                queryApi3.queryRows(query(bucket), {
                    next(row, tableMeta) {
                        data.push(tableMeta.toObject(row));
                    },
                    error(error) {
                        resolve({ [type]: error })
                    },
                    complete() {
                        resolve({ [type]: data })
                    },
                });
            }),
        ]
    ).then(values => {
        const payload = {
            digest: {
                current: values.filter((e:any): e is currentWeatherI => e.current)[0].current[0],
                hourly: values.filter((e:any): e is hourlyWeatherI => e.hourly)[0].hourly,
                daily: values.filter((e:any): e is dailyWeatherI => e.daily)[0].daily
            }
        }

        axios.post(
            "https://us-west1-skyviewer.cloudfunctions.net/redis-client/summit-status", 
            payload
        ).then(response => {
            return res.status(200).json(values);
        });
        
    });

  });