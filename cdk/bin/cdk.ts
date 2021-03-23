#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkStack } from '../lib/cdk-stack';
import { NotebookStack } from '../lib/notebook-stack';

const app = new cdk.App();
const dlStack = new CdkStack(app, 'CdkStack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: 'us-east-1' 
    },
    stackName: 'GlueStudioDemoStack'
});

new NotebookStack(app, 'NotebookStack', {
    env: { 
        account: process.env.CDK_DEFAULT_ACCOUNT, 
        region: 'us-east-1' 
    },
    bucket: dlStack.dataLakeBucket,
    databaseName: dlStack.databaseName,
})
