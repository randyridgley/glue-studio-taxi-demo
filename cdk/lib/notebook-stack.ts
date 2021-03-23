import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue');
import lf = require('@aws-cdk/aws-lakeformation');
import sagemaker = require('@aws-cdk/aws-sagemaker');

interface NotebookStackProps {
  bucket: s3.Bucket;
  databaseName: string;
  readonly env?: cdk.Environment;
}

export class NotebookStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: NotebookStackProps) {
    super(scope, id, props as cdk.StackProps);

    const sagemakerServiceRole = new iam.Role(this, 'AWSSagemakerNotebookServiceRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('sagemaker.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
      ],
      path: '/service-role/'
    });

    sagemakerServiceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess'
      ],
      resources: ['*']
    }));

    sagemakerServiceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "cloudformation:DescribeStacks"
      ],
      resources: ['*']
    }));

    props.bucket.grantReadWrite(sagemakerServiceRole);

    const dlSagePermission = new lf.CfnPermissions(this, 'DataLakeLocationPermissionSagemakerService', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: sagemakerServiceRole.roleArn,
      },
      resource: {
        dataLocationResource: {
          s3Resource: props.bucket.bucketArn
        }
      },
      permissions: [
        'DATA_LOCATION_ACCESS'
      ]
    });

    new lf.CfnPermissions(this, 'DatabasePermissionSagemakerServiceRole', {
      resource: {
        databaseResource: {
          name: props.databaseName
        }
      },
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: sagemakerServiceRole.roleArn
      },
      permissions: ['ALL']
    });

    const notebook = new sagemaker.CfnNotebookInstance(this, 'GlueStudioPrepNotebook', {
      notebookInstanceName: "GlueStudioPrepNotebook",
      defaultCodeRepository: 'https://github.com/randyridgley/glue-studio-taxi-demo',
      roleArn: sagemakerServiceRole.roleArn,
      instanceType: 'ml.t2.medium'
    });

    new cdk.CfnOutput(this, 'SagemakerRoleArn', {
      value: sagemakerServiceRole.roleArn,
    });

    new cdk.CfnOutput(this, 'SageMakerNotebook', {
      value: notebook.ref,
    });
  }
}