import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { CreateDealerLambda} from '../create-lambda/create-dealer-lambda';
import { CreateDealerDataSource } from '../create-datasource/create-dealer-datasource';
import { CreateDealerResolver } from '../create-resolver/create-dealer-resolver';

export class CdkProductsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create a new Cognito User Pool
    const userPool = new cognito.UserPool(this, 'nissan-user-pool', {
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

     // Create Cognito User Pool Client
     const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool
    });

    // 2. Create new AppSync API
    const api = new appsync.GraphqlApi(this, 'nissan-appsync-api', {
      name: 'nissan-appsync-api',
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      schema: appsync.SchemaFile.fromAsset('graphql/schema.graphql'),
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


    // Dealer Feature
   const dealerLambda = new CreateDealerLambda(this,"Dealer-Lambda")
            .createDealerLambdaFunction("Dealer-Lambda",api)

   const delaerDataSource = new CreateDealerDataSource(this,"Dealer-datasource")
            .configureLambdaDataSource("Dealer-datasource",api,dealerLambda)

   new CreateDealerResolver(this,"Dealer-resolver")
            .createDealerResolver("Dealer-resolver",api,delaerDataSource,dealerLambda)

    // Models Feature
    // Inventory
    // Used Cars

    new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    });

    new cdk.CfnOutput(this, 'GraphQLAPIKey', {
      value: api.apiKey || '',
    });

  }
}
