import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue');
import lf = require('@aws-cdk/aws-lakeformation');
import sagemaker = require('@aws-cdk/aws-sagemaker');

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dataLakeServiceRole = new iam.Role(this, 'AWSGlueStudioPrepServiceRole', {
      roleName: 'AWSGlueServiceRole-StudioTaxi',
      assumedBy:  new iam.CompositePrincipal(
        new iam.ServicePrincipal('glue.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLakeFormationDataAdmin'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')
      ],
      path: '/service-role/'
    });

    dataLakeServiceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess'
      ],
      resources: ['*']
    }));

    const sagemakerServiceRole = new iam.Role(this, 'AWSSagemakerNotebookServiceRole', {
      roleName: 'AWSServiceSageMaker-StudioTaxi',
      assumedBy:  new iam.CompositePrincipal(
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


    const dataLakeBucket = new s3.Bucket(this, "DataLakeBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    dataLakeBucket.grantReadWrite(dataLakeServiceRole);
    dataLakeBucket.grantReadWrite(sagemakerServiceRole);

    // LakeFormation Resource registration and permissions
    const dlsResource = new lf.CfnResource(this, 'dataLakeBucketLakeFormationResourceService', {
      resourceArn: dataLakeBucket.bucketArn,
      roleArn: dataLakeServiceRole.roleArn,
      useServiceLinkedRole: false
    });

    const dlsPermission = new lf.CfnPermissions(this, 'DataLakeLocationPermissionService', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeServiceRole.roleArn,
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
    dlsPermission.node.addDependency(dlsResource)

    const db = new glue.Database(this, 'TaxiGlueStudioDatabase', {
      databaseName: 'taxi_demo'
    });

    new lf.CfnPermissions(this, 'DatabasePermissionServiceRole', {
      resource: {
        databaseResource: {
          name: db.databaseName
        }
      },
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeServiceRole.roleArn
      },
      permissions: ['ALL']
    });

    new lf.CfnPermissions(this, 'DatabasePermissionServiceRole', {
      resource: {
        databaseResource: {
          name: db.databaseName
        }
      },
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: sagemakerServiceRole.roleArn
      },
      permissions: ['DESCRIBE']
    });

    let crawler_name = 'GlueStudioTaxiDemoCrawler';

    const datalakeCrawler = new glue.CfnCrawler(this, 'DataLakeCrawler', {
      name: crawler_name,
      role: dataLakeServiceRole.roleArn,
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
      roleArn: sagemakerServiceRole.roleArn,
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
      value: dataLakeServiceRole.roleArn,
    });

    new cdk.CfnOutput(this, 'SagemakerRoleArn', {
      value: sagemakerServiceRole.roleArn,
    });

    new cdk.CfnOutput(this, 'SageMakerNotebook', {
      value: notebook.ref,
    });
  }
}
