import 'dotenv/config'
import * as ff from '@google-cloud/functions-framework';
import { InfluxDB } from "@influxdata/influxdb-client";
import { currentWeather, hourlyWeather, dailyWeather } from "./queries";
import axios from "axios";

const types = {
    current: currentWeather,
    hourly: hourlyWeather,
    daily: dailyWeather,
};

async function dailySummitStats(req: ff.Request, res: ff.Response) {
    const url:string = String(process.env.EFD_URL);
    const bucket:string = String(process.env.EFD_BUCKET);
    const token:string = String(process.env.EFD_TOKEN);
    const timeout:number = 30000;
    const influxDB = new InfluxDB({ url, token, timeout });
    const queryApi = influxDB.getQueryApi("");

    new Promise((resolve, reject) => {
        let type = "daily";
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
    }).then((values:any) => {
        const payload = {
            daily: values.daily
        }

        axios.post(
            "https://us-west1-skyviewer.cloudfunctions.net/redis-client/daily-stats", 
            payload
        ).then(response => {
            if(response.data.status == "SUCCESS") {
                return res.status(200).json(payload);
            } else {
                return res.status(500).json(response.data);
            }
        }).catch(err => {
            console.error(err.response);
            return res.status(500).json(err.data);
        });
    }).catch(error => {
        console.log(error)
        return res.status(500).json(error);
    });
}

ff.http("summit-stats", async (req: ff.Request, res: ff.Response) => {

    if(req.path == "/") {
        return res.status(200).send("🐈‍⬛");
    } else if(req.path == "/hourly-stats") {
        return hourlySummitStats(req, res);
    } else if(req.path == "/current-stats") {
        return currentSummitStats(req, res);
    } else if(req.path == "/daily-stats") {
        return dailySummitStats(req, res);
    // } else if(req.path == "/azimuth-stats") {
    //     return azimuthSummitStats(req, res);
    } else {
        return res.status(400).send("Oopsies.");
    }
    
});

// async function azimuthSummitStats(req: ff.Request, res: ff.Response) {
//     const url:string = String(process.env.EFD_URL);
//     const bucket:string = String(process.env.EFD_BUCKET);
//     const token:string = String(process.env.EFD_TOKEN);

//     const influxDB = new InfluxDB({ url, token });
//     const queryApi = influxDB.getQueryApi("");

//     new Promise((resolve, reject) => {
//         let type = "azimuth";
//         let test:any = type;
//         const query = types[test as keyof Object];
//         const data:any = [];
//         queryApi.queryRows(query(bucket), {
//             next(row, tableMeta) {
//                 data.push(tableMeta.toObject(row));
//             },
//             error(error) {
//                 resolve({ [type]: error })
//             },
//             complete() {
//                 resolve({ [type]: data })
//             },
//         });
//     }).then((values:any) => {
//         const payload = {
//             azimuth: values.azimuth
//         }
//         res.status(200).json(payload);

//         // axios.post(
//         //     "https://us-west1-skyviewer.cloudfunctions.net/redis-client/hourly-stats", 
//         //     payload
//         // ).then(response => {
//         //     console.log(`status from redis-client for hourly POST: ${response.data}`)
//         //     if(response.data.status == "SUCCESS") {
//         //         return res.status(200).json(payload);
//         //     } else {
//         //         return res.status(500).json(response.data);
//         //     }
//         // }).catch(err => {
//         //     console.error("an error occurred, caught in the .catch()");
//         //     console.error(err);
//         //     return res.status(500).json(err.data);
//         // });
//     }).catch(error => {
//         return res.status(500).json(error);
//     });
// }

async function hourlySummitStats(req: ff.Request, res: ff.Response) {
    const url:string = String(process.env.EFD_URL);
    const bucket:string = String(process.env.EFD_BUCKET);
    const token:string = String(process.env.EFD_TOKEN);
    const influxDB = new InfluxDB({ url, token });
    const queryApi = influxDB.getQueryApi("");

    new Promise((resolve, reject) => {
        let type = "hourly";
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
    }).then((values:any) => {
        const payload = {
            hourly: values.hourly
        }

        axios.post(
            "https://us-west1-skyviewer.cloudfunctions.net/redis-client/hourly-stats", 
            payload
        ).then(response => {
            if(response.data.status == "SUCCESS") {
                return res.status(200).json(payload);
            } else {
                return res.status(500).json(response.data);
            }
        }).catch(err => {
            console.error(err.response);
            return res.status(500).json(err.data);
        });
    }).catch(error => {
        console.log(error);
        return res.status(500).json(error);
    });
}

async function currentSummitStats(req: ff.Request, res: ff.Response) {
    const url:string = String(process.env.EFD_URL);
    const bucket:string = String(process.env.EFD_BUCKET);
    const token:string = String(process.env.EFD_TOKEN);
    const influxDB = new InfluxDB({ url, token });
    const queryApi = influxDB.getQueryApi("");

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
        }).then((values:any)  => {
            const payload = {
                current: values.current[0]
            }
        
        axios.post(
            "https://us-west1-skyviewer.cloudfunctions.net/redis-client/current-stats", 
            payload
        ).then(response => {
            if(response.data.status == "SUCCESS") {
                return res.status(200).json(payload);
            } else {
                return res.status(500).json(response);
            }
        }).catch(err => {
            console.error(err.response);
            return res.status(500).json(err.data);
        });
        
    }).catch(error => {
        return res.status(500).json(error);
    });

  }