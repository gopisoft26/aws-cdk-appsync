import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class CreateDealerLambda extends Construct {

constructor(scope: Construct,id:any) {
    super(scope,id)
}

 createDealerLambdaFunction(feature: string, api: appsync.GraphqlApi) {
    return new lambda.Function(this, 'dealerHandlder', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'dealer-main.handler', 
        code: lambda.Code.fromAsset('assets/dealer-function'),
        memorySize: 1024,
      });
 }



}