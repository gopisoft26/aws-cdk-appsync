import { StackProps } from "aws-cdk-lib";
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

export class CreateDealerResolver extends Construct {

    constructor(scope: Construct, feature: string) {
        super(scope, feature);
    }

  createDealerResolver(feature:any,api: appsync.GraphqlApi,lambdaDs: appsync.LambdaDataSource,dealerLambda: lambda.Function): void {

        new appsync.Resolver(this, 'CreateDealerResolver', {
            api,
            dataSource: lambdaDs,
            typeName: 'Mutation',
            fieldName: 'createDealer',
        });
        
        new appsync.Resolver(this, 'ListdealersResolver', {
            api,
            dataSource: lambdaDs,
            typeName: 'Query',
            fieldName: 'listDealers',
        });
        
        new appsync.Resolver(this, 'GetdealerByIdResolver', {
            api,
            dataSource: lambdaDs,
            typeName: 'Query',
            fieldName: 'getDealerById',
        });
        
        new appsync.Resolver(this, 'deleteByDealerIdResolver', {
            api,
            dataSource: lambdaDs,
            typeName: 'Mutation',
            fieldName: 'deleteByDealerId',
        });
        
        
        // 6. Create DynamoDB table
        const dealerTable = new dynamodb.Table(this, 'Dealers', {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
            name: 'id',
            type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        
        // Add a global secondary index to enable another data access pattern
        dealerTable.addGlobalSecondaryIndex({
            indexName: 'dealerByBrand',
            partitionKey: {
            name: 'brand',
            type: dynamodb.AttributeType.STRING,
            },
        });
        
        // Enable the Lambda function to access the DynamoDB table (using IAM)
        dealerTable.grantFullAccess(dealerLambda);
        
        // Create an environment variable that we will use in the function code
        dealerLambda.addEnvironment('DEALER_TABLE', dealerTable.tableName);

  }


}