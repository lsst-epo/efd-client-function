# efc-client-function

The `summit-client` function serves up data from the EFD for the summit status dashboar widgets.

It is called via Cloud Scheduler on a regular basis and also by Hasura. It stores the responses from the EFD in Redis via the `redis-cloud-function`.

## Deployment

First, build the typescript:

```
yarn build
```

The above command will create a `/dist` folder with the built Javascript.

Then, ensure your `gcloud` CLI is pointed at the correct GCP project and deploy the cloud function:

```
sh deploy.sh
```