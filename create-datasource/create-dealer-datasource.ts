import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class CreateDealerDataSource extends Construct {
    constructor(scope: Construct, feature: string) {
        super(scope, feature);
    }
    configureLambdaDataSource(feature:any,api: appsync.GraphqlApi,lambdaFunction: lambda.Function) {
      return api.addLambdaDataSource(feature, lambdaFunction);
    }
}