import { StackProps } from "aws-cdk-lib";
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { Construct } from "constructs";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class ProductResolver extends Construct {

constructor(scope: Construct, feature: string, api: appsync.GraphqlApi) {
    super(scope, feature);
   
 const productLambda = new lambda.Function(this, 'AppSyncProductHandler', {
    runtime: lambda.Runtime.NODEJS_18_X,  // Update to a supported runtime
    handler: 'main.handler',  // Ensure this matches your Lambda function's handler
    code: lambda.Code.fromAsset('lambda-fns'),
    memorySize: 1024
  });
  
  // Add the Lambda function as a data source for AppSync
  const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda)
   
  // Create multiple resolvers
 new appsync.Resolver(this, 'CreateProductResolver', {
    api,
    dataSource: lambdaDs,
    typeName: 'Mutation',
    fieldName: 'createProduct',
  });

 new appsync.Resolver(this, 'listProductsResolver', {
    api,
    dataSource: lambdaDs,
    typeName: 'Query',
    fieldName: 'listProducts',
  });

  new appsync.Resolver(this, 'getProductByIdResolver', {
    api,
    dataSource: lambdaDs,
    typeName: 'Query',
    fieldName: 'getProductById',
  });

 
  // Create dynamo db
  const productTable = new dynamodb.Table(this, 'CDKProductTable', {
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
    },
  });
  
  // Add a global secondary index to enable another data access pattern
  productTable.addGlobalSecondaryIndex({
    indexName: "productsByCategory",
    partitionKey: {
        name: "category",
        type: dynamodb.AttributeType.STRING,
    }
  });
  
  // Enable the Lambda function to access the DynamoDB table (using IAM)
  productTable.grantFullAccess(productLambda);
  
  // Create an environment variable that we will use in the function code
  productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName);

    }
}