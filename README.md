# Glue Studio Demo

This is a demo to showcase the ease of use Glue Studio brings to building Glue jobs in AWS. This demo is using the CDK to create the initial infrastructure. Once the setup is complete you should have a SageMaker notebook instance, S3 bucket, IAM Role, Glue database and crawler. This is all you need to get started using Glue Studio. 

This repo also assumes the Glue Studio job will be running in an account the is using AWS Lake Formation as well for managing the security of the Glue dat Catalog. Using Lake Formation you can limit access to data lake resources down to the column level when using the Glue Data Catalog.

## Configure required AWS account

Check that your AWS account is configured. Assume the role in the shell:

```bash
# Install from https://github.com/remind101/assume-role
eval $(assume-role your-aws-role)
```

## Initial setup

First you need to have the needed build tools and the AWS CDK installed.
After everything is installed you can bootstrap the project on wanted account.

* Install Node <https://nodejs.org>

### Install dependencies

```bash
brew install node awscli
# Install or update CDK globally
npm i -g aws-cdk
```

### Bootstrap the project on a selected account

```bash
# Go to the cdk directory
cd cdk/
# Initial build
npm run build
# Initialize the environment
cdk bootstrap aws://account-id/region
```
## Initial deployment

Check that the stack builds.

```bash
npm run build
```

Bootstrap the account.

```bash
cdk bootstrap aws://<account>/us-east-1
```

Deploy the demo

```bash
cdk deploy
```

## Other commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template