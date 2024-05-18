import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class CdkProductsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new Cognito User Pool
    const userPool = new cognito.UserPool(this, 'cdk-products-user-pool', {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
    });

    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, 'product-app', {
      name: 'product-api',
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      schema: appsync.SchemaFile.fromAsset('graphql/schema.graphql'), // Ensure this path is correct
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool,
            },
          },
        ],
      },
    });

    // Create the Lambda function
    const productLambda = new lambda.Function(this, 'ProductHandler', {
      runtime: lambda.Runtime.NODEJS_20_X, // Update to a supported runtime
      handler: 'main.handler', // Ensure this matches your Lambda function's handler
      code: lambda.Code.fromAsset('lambda-fns'), // Ensure this path is correct
      memorySize: 1024,
    });

    // Add the Lambda function as a data source for AppSync
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda);

    // Create multiple resolvers
    new appsync.Resolver(this, 'CreateProductResolver', {
      api,
      dataSource: lambdaDs,
      typeName: 'Mutation',
      fieldName: 'createProduct',
    });

    new appsync.Resolver(this, 'ListProductsResolver', {
      api,
      dataSource: lambdaDs,
      typeName: 'Query',
      fieldName: 'listProducts',
    });

    new appsync.Resolver(this, 'GetProductByIdResolver', {
      api,
      dataSource: lambdaDs,
      typeName: 'Query',
      fieldName: 'getProductById',
    });

    // Create DynamoDB table
    const productTable = new dynamodb.Table(this, 'CDKProductTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Add a global secondary index to enable another data access pattern
    productTable.addGlobalSecondaryIndex({
      indexName: 'productsByCategory',
      partitionKey: {
        name: 'category',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Enable the Lambda function to access the DynamoDB table (using IAM)
    productTable.grantFullAccess(productLambda);

    // Create an environment variable that we will use in the function code
    productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName);

    // Output the GraphQL API URL
    new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    });

    // Output the API Key
    new cdk.CfnOutput(this, 'GraphQLAPIKey', {
      value: api.apiKey || '',
    });
  }
}
