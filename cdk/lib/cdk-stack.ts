import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import iam = require('@aws-cdk/aws-iam');
import glue = require('@aws-cdk/aws-glue');
import lf = require('@aws-cdk/aws-lakeformation');
import sagemaker = require('@aws-cdk/aws-sagemaker');

export class CdkStack extends cdk.Stack {
  public readonly dataLakeBucket: s3.Bucket
  public readonly databaseName: string

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.databaseName = 'taxi_studio_demo'

    const dataLakeServiceRole = new iam.Role(this, 'AWSGlueStudioPrepServiceRole', {
      assumedBy:  new iam.CompositePrincipal(
        new iam.ServicePrincipal('glue.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLakeFormationDataAdmin')
      ],
      path: '/service-role/'
    });

    dataLakeServiceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'lakeformation:GetDataAccess'
      ],
      resources: ['*']
    }));

    this.dataLakeBucket = new s3.Bucket(this, "DataLakeBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.dataLakeBucket.grantReadWrite(dataLakeServiceRole);    

    // LakeFormation Resource registration and permissions
    const dlsResource = new lf.CfnResource(this, 'dataLakeBucketLakeFormationResourceService', {
      resourceArn: this.dataLakeBucket.bucketArn,
      roleArn: dataLakeServiceRole.roleArn,
      useServiceLinkedRole: false
    });
    dlsResource.node.addDependency(this.dataLakeBucket)

    const dlsPermission = new lf.CfnPermissions(this, 'DataLakeLocationPermissionService', {
      dataLakePrincipal: {
        dataLakePrincipalIdentifier: dataLakeServiceRole.roleArn,
      },
      resource: {
        dataLocationResource: {
          s3Resource: this.dataLakeBucket.bucketArn
        }
      },
      permissions: [
        'DATA_LOCATION_ACCESS'
      ]
    });
    dlsPermission.node.addDependency(dlsResource)

    const db = new glue.Database(this, 'TaxiGlueStudioDatabase', {
      databaseName: this.databaseName
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

    let crawler_name = 'GlueStudioTaxiDemoCrawler';

    const datalakeCrawler = new glue.CfnCrawler(this, 'DataLakeCrawler', {
      name: crawler_name,
      role: dataLakeServiceRole.roleArn,
      databaseName: db.databaseName,
      targets: {
        s3Targets: [
          {
            path: 's3://' + this.dataLakeBucket.bucketName + '/datalake/'
          }
        ]
      }
    });

    new cdk.CfnOutput(this, 'TaxiDatabase', {
      value: db.databaseName,
    });

    new cdk.CfnOutput(this, 'TaxiDataCrawler', {
      value: crawler_name,
    });

    new cdk.CfnOutput(this, 'DataLakeBucketName', {
      value: this.dataLakeBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DataLakeRoleArn', {
      value: dataLakeServiceRole.roleArn,
    });
  }
}
