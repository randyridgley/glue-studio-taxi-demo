import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue');
import lf = require('@aws-cdk/aws-lakeformation');
import sagemaker = require('@aws-cdk/aws-sagemaker');

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dataLakeRole = new iam.Role(this, 'GlueStudioPrepServiceRole', {
      roleName: 'GlueStudioDataLakeServiceLinkedRole',
      assumedBy:  new iam.CompositePrincipal(
        new iam.ServicePrincipal('glue.amazonaws.com'),
        new iam.ServicePrincipal('lakeformation.amazonaws.com'),
        new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLakeFormationDataAdmin'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
      ],
      path: '/service-role/'
    });

    dataLakeRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess'
      ],
      resources: ['*']
    }));

    dataLakeRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "cloudformation:DescribeStacks"
      ],
      resources: ['*']
    }));

    const dataLakeBucket = new s3.Bucket(this, "DataLakeBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    dataLakeBucket.grantReadWrite(dataLakeRole);

    // LakeFormation Resource registration and permissions
    const dlResource = new lf.CfnResource(this, 'dataLakeBucketLakeFormationResource', {
      resourceArn: dataLakeBucket.bucketArn,
      roleArn: dataLakeRole.roleArn,
      useServiceLinkedRole: false
    });

    const dlPermission = new lf.CfnPermissions(this, 'DataLakeLocationPermission', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeRole.roleArn,
      },
      resource: {
        dataLocationResource: {
          s3Resource: dataLakeBucket.bucketArn
        }
      },
      permissions: [
        'DATA_LOCATION_ACCESS'
      ]
    });
    dlPermission.node.addDependency(dlResource)

    const db = new glue.Database(this, 'TaxiGlueStudioDatabase', {
      databaseName: 'taxi_demo'
    });

    new lf.CfnPermissions(this, 'DatabasePermission', {
      resource: {
        databaseResource: {
          name: db.databaseName
        }
      },
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeRole.roleArn
      },
      permissions: ['ALL']
    });

    let crawler_name = 'GlueStudioTaxiDemoCrawler';

    const datalakeCrawler = new glue.CfnCrawler(this, 'DataLakeCrawler', {
      name: crawler_name,
      role: dataLakeRole.roleArn,
      databaseName: db.databaseName,
      targets: {
        s3Targets: [
          {
            path: 's3://' + dataLakeBucket.bucketName + '/datalake/'
          }
        ]
      }
    });

    const notebook = new sagemaker.CfnNotebookInstance(this, 'GlueStudioPrepNotebook', {
      notebookInstanceName: "GlueStudioPrepNotebook",
      defaultCodeRepository: 'https://github.com/randyridgley/glue-studio-taxi-demo',
      roleArn: dataLakeRole.roleArn,
      instanceType: 'ml.t2.medium'
    });

    new cdk.CfnOutput(this, 'TaxiDatabase', {
      value: db.databaseName,
    });

    new cdk.CfnOutput(this, 'TaxiDataCrawler', {
      value: crawler_name,
    });

    new cdk.CfnOutput(this, 'DataLakeBucketName', {
      value: dataLakeBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DataLakeRoleArn', {
      value: dataLakeRole.roleArn,
    });

    new cdk.CfnOutput(this, 'SageMakerNotebook', {
      value: notebook.ref,
    });
  }
}
