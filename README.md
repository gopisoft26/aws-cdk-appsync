Environment & prerequisites
Before we begin, make sure you have the following:

Node.js v10.3.0 or later installed
A valid and confirmed AWS account
You must provide IAM credentials and an AWS Region to use AWS CDK, if you have not already done so. If you have the AWS CLI installed, the easiest way to satisfy this requirement is to install the AWS CLI and issue the following command:
aws configure
When configuring the IAM user, be sure to give them Administrator Access Privileges

IAM Permissions

We will be working from a terminal using a Bash shell to run CDK CLI commands to provision and deploy infrastructure.

To view the CDK pre-requisite docs, click here

Background needed / level
This workshop is intended for intermediate to advanced JavaScript developers wanting to learn more about full stack serverless development.

While some level of GraphQL is helpful, because all code provided is copy and paste-able, this workshop requires zero previous knowledge of GraphQL.

Topics we'll be covering:
CDK
GraphQL API with AWS AppSync
Authentication with Amazon Cognito
Authorization in AWS Lambda
Data persistence with DynamoDB
Business logic running in AWS Lambda
Deleting the resources
Getting Started
Installing the CLI & Initializing a new CDK Project
First, install the CDK CLI:

npm install -g aws-cdk
Next, create a new directory namned cdk-products, change into it, and initialize a new CDK project.

mkdir cdk-products
cd cdk-products
cdk init --language=typescript
The CDK CLI has initialized a new project.

To build the project at any time, you can run the build command:

npm run build
To view the resources to be deployed or changes in infrastructure at any time, you can run the CDK diff command:

cdk diff
Next, install the CDK dependencies we'll be using using either npm or yarn:

npm install @aws-cdk/aws-cognito @aws-cdk/aws-appsync @aws-cdk/aws-lambda @aws-cdk/aws-dynamodb
Creating the authentication service with CDK
When working with CDK, the code for the main stack lives in the lib directory. When we created the project, the CLI created a file named lib/cdk-products-stack.ts where our stack code is written.

Open the file and let's first import the constructs and classes we'll need for our project:

// lib/cdk-products-stack.ts
import * as cdk from '@aws-cdk/core'
import * as cognito from '@aws-cdk/aws-cognito'
import * as appsync from '@aws-cdk/aws-appsync'
import * as ddb from '@aws-cdk/aws-dynamodb'
import * as lambda from '@aws-cdk/aws-lambda'
Next, update the class with the following code to create the Amazon Cognito authentication service:

// lib/cdk-products-stack.ts
export class CdkProductsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'cdk-products-user-pool', {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      }
    })

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool
    })

  }
}
This code will create a Cognito User Pool that will enable the user to sign in with a username, email address, and password.

A userPoolClient will also be created enabling client applications to interact with the service.

Adding the AWS AppSync GraphQL API with CDK
Next, we'll need to create the AppSync GraphQL API.

To create the API, add the following code below the User Pool definition in lib/cdk-products-stack.ts.

const api = new appsync.GraphqlApi(this, 'cdk-product-app', {
  name: "cdk-product-api",
  logConfig: {
    fieldLogLevel: appsync.FieldLogLevel.ALL,
  },
  schema: appsync.Schema.fromAsset('./graphql/schema.graphql'),
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.API_KEY,
      apiKeyConfig: {
        expires: cdk.Expiration.after(cdk.Duration.days(365))
      }
    },
    additionalAuthorizationModes: [{
      authorizationType: appsync.AuthorizationType.USER_POOL,
      userPoolConfig: {
        userPool,
      }
    }]
  },
})
This code will create an AppSync GraphQL API with two types of authentication: API Key (public access) and Amazon Cognito User Pool (private, authenticated access).

Our app will be using a combination of public and private access to achieve a common real world use case that combines the two types of access.

For example, we want all users to be able to query for products whether they are signed in or not, but if a user is signed in and part of an Admin group, we want to give them the correct access so that they can create, update or delete products.

Adding the GraphQL schema
In the code where we defined the GraphQL API, we set the GraphQL schema directory as ./graphql/schema.graphql, but we have not yet created the schema, so let's do that now.

In the root of the CDK project, create a folder called graphql and a file in that folder named schema.graphql. In that file, add the following code:

# graphql/schema.graphql
type Product @aws_api_key @aws_cognito_user_pools {
  id: ID!
  name: String!
  description: String!
  price: Float!
  category: String!
  sku: String
  inventory: Int
}

input ProductInput {
  id: ID
  name: String!
  description: String!
  price: Float!
  category: String!
  sku: String
  inventory: Int
}

input UpdateProductInput {
  id: ID!
  name: String
  description: String
  price: Float
  category: String
  sku: String
  inventory: Int
}

type Query {
  getProductById(productId: ID!): Product
    @aws_api_key @aws_cognito_user_pools
  listProducts: [Product]
    @aws_api_key @aws_cognito_user_pools
  productsByCategory(category: String!): [Product]
    @aws_api_key @aws_cognito_user_pools
}

type Mutation {
  createProduct(product: ProductInput!): Product
    @aws_cognito_user_pools(cognito_groups: ["Admin"])
  deleteProduct(productId: ID!): ID
    @aws_cognito_user_pools(cognito_groups: ["Admin"])
  updateProduct(product: UpdateProductInput!): Product
    @aws_cognito_user_pools(cognito_groups: ["Admin"])
}

type Subscription {
  onCreateProduct: Product
    @aws_subscribe(mutations: ["createProduct"])
}
This schema defines the Product type that we'll be needing along with all of the input types and operations for creating, updating, and reading Products.

There are also authorization rules set in place by using @aws_api_key and @aws_cognito_user_pools.

@aws_api_key enables public access.

@aws_cognito_user_pools configures private access for signed in users.

You will notice that some of the queries enable both public and private access, while the mutations only allow private access. That is because we only want to enable signed in users to be able to create or update Products, and we will even be implementing businness logic that only allows users to update Products if they are in an Admin group.

Adding and configuring a Lambda function data source
Next, we'll create a Lambda function. The Lambda function will be the main datasource for the API, meaning we will map all of the GraphQL operations (mutations and subscriptions) into the function.

The function will then call the DynamoDB database to execute of the operations we will be needing for creating, reading, updating, and deleting items in the database.

To create the Lambda function, add the following code below the API definition in lib/cdk-products-stack.ts.

// lib/cdk-products-stack.ts

// Create the function
const productLambda = new lambda.Function(this, 'AppSyncProductHandler', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'main.handler',
  code: lambda.Code.fromAsset('lambda-fns'),
  memorySize: 1024
})

// Set the new Lambda function as a data source for the AppSync API
const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda)
Adding the GraphQL resolvers
Now we will create the GraphQL resolver definitions that will map the requests coming into the API into the Lambda function.

To create the resolvers, add the following code below the Lambda function definition in lib/cdk-products-stack.ts.

// lib/cdk-products-stack.ts
lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "getProductById"
})

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "listProducts"
})

lambdaDs.createResolver({
  typeName: "Query",
  fieldName: "productsByCategory"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "createProduct"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "deleteProduct"
})

lambdaDs.createResolver({
  typeName: "Mutation",
  fieldName: "updateProduct"
})
Creating the database
Next, we'll create the DynamoDB table that our API will be using to store data.

To create the database, add the following code below the GraphQL resolver definitions in lib/cdk-products-stack.ts.

// lib/cdk-products-stack.ts
const productTable = new ddb.Table(this, 'CDKProductTable', {
  billingMode: ddb.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: 'id',
    type: ddb.AttributeType.STRING,
  },
})

// Add a global secondary index to enable another data access pattern
productTable.addGlobalSecondaryIndex({
  indexName: "productsByCategory",
  partitionKey: {
    name: "category",
    type: ddb.AttributeType.STRING,
  }
})

// Enable the Lambda function to access the DynamoDB table (using IAM)
productTable.grantFullAccess(productLambda)

// Create an environment variable that we will use in the function code
productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName)
Printing out resource values for client-side configuration
If we’d like to consume the API from a client application we’ll need the values of the API key, GraphQL URL, Cognito User Pool ID, Cognito User Pool Client ID, and project region to configure our app.

We could go inside the AWS console for each service and find these values, but CDK enables us to print these out to our terminal upon deployment as well as map these values to an output file that we can later import in our web or mobile application and use with AWS Amplify.

To create these output values, add the following code below the DynamoDB table definition in lib/cdk-products-stack.ts.

// lib/cdk-products-stack.ts

new cdk.CfnOutput(this, "GraphQLAPIURL", {
  value: api.graphqlUrl
})

new cdk.CfnOutput(this, 'AppSyncAPIKey', {
  value: api.apiKey || ''
})

new cdk.CfnOutput(this, 'ProjectRegion', {
  value: this.region
})

new cdk.CfnOutput(this, "UserPoolId", {
  value: userPool.userPoolId
})

new cdk.CfnOutput(this, "UserPoolClientId", {
  value: userPoolClient.userPoolClientId
})
Adding the Lambda function code
The last thing we need to do is write the code for the Lambda function. The Lambda function will map the GraphQL operations coming in via the event into a call to the DynamoDB database. We will have functions for all of the operations defined in the GraphQL schema. The Lambda handler will read the GraphQL operation from the event object and call the appropriate function.

Create a folder named lambda-fns in the root directory of the CDK project. Next, change into this directory and initialize a new package.json file and install the uuid library:

cd lambda-fns
npm init --y
npm install uuid
In the lambda-fns folder, create the following files:

Product.ts
main.ts
createProduct.ts
listProducts.ts
getProductById.ts
deleteProduct.ts
updateProduct.ts
productsByCategory.ts
Product.ts
type Product = {
  id: string,
  name: string,
  description: string,
  price: number,
  category: string,
  inventory: number
}

export default Product
The Product type should match the GraphQL Product type and will be used in a couple of our files.

main.ts
import getProductById from './getProductById'
import createProduct from './createProduct'
import listProducts from './listProducts'
import deleteProduct from './deleteProduct'
import updateProduct from './updateProduct'
import productsByCategory from './productsByCategory'
import Product from './Product'

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    productId: string,
    category: string
    product: Product,
  },
  identity: {
    username: string,
    claims: {
      [key: string]: string[]
    }
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    case "getProductById":
      return await getProductById(event.arguments.productId)
    case "createProduct":
      return await createProduct(event.arguments.product)
    case "listProducts":
      return await listProducts()
    case "deleteProduct":
      return await deleteProduct(event.arguments.productId)
    case "updateProduct":
      return await updateProduct(event.arguments.product)
    case "productsByCategory":
      return await productsByCategory(event.arguments.category)
    default:
      return null
  }
}
The handler function will use the GraphQL operation available in the event.info.fieldname to call the various functions that will interact with the DynamoDB database.

The function will also be passed an identity object if the request has been authenticated by AppSync. If the event is coming from an authenticated request, then the identity object will be null.

Fields protected with @aws_cognito_user_pools(cognito_groups: ["Admin"]) will only allow users who are signed in and part of the Admin group to perform the operation.

To manually check for groups, you can get the user's identity from the event.identity object and check for claims in the event.identity.claims['cognito:groups'].

createProduct.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()
import Product from './Product'
const { v4: uuid } = require('uuid')

async function createProduct(product: Product) {
  if (!product.id) {
    product.id = uuid()
  }
  const params = {
    TableName: process.env.PRODUCT_TABLE,
    Item: product
  }
  try {
    await docClient.put(params).promise()
    return product
  } catch (err) {
    console.log('DynamoDB error: ', err)
    return null
  }
}

export default createProduct
The createProduct function takes in a product as an argument. We then check to see if there is already an id associated with it, if there is not an id we generate one.

listProducts.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

async function listProducts() {
    const params = {
        TableName: process.env.PRODUCT_TABLE,
    }
    try {
        const data = await docClient.scan(params).promise()
        return data.Items
    } catch (err) {
        console.log('DynamoDB error: ', err)
        return null
    }
}

export default listProducts
getProductByID.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

async function getProductById(productId: string) {
    const params = {
        TableName: process.env.PRODUCT_TABLE,
        Key: { id: productId }
    }
    try {
        const { Item } = await docClient.get(params).promise()
        return Item
    } catch (err) {
        console.log('DynamoDB error: ', err)
    }
}

export default getProductById
deleteProduct.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

async function deleteProduct(productId: string) {
  const params = {
    TableName: process.env.PRODUCT_TABLE,
    Key: {
      id: productId
    }
}
  try {
    await docClient.delete(params).promise()
    return productId
  } catch (err) {
    console.log('DynamoDB error: ', err)
    return null
  }
}

export default deleteProduct
updateProduct.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

type Params = {
  TableName: string | undefined,
  Key: string | {},
  ExpressionAttributeValues: any,
  ExpressionAttributeNames: any,
  UpdateExpression: string,
  ReturnValues: string,
}

async function updateProduct(product: any) {
  let params : Params = {
    TableName: process.env.PRODUCT_TABLE,
    Key: {
      id: product.id
    },
    UpdateExpression: "",
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
    ReturnValues: "UPDATED_NEW"
  }
  let prefix = "set "
  let attributes = Object.keys(product)
  for (let i=0; i<attributes.length; i++) {
    let attribute = attributes[i]
    if (attribute !== "id") {
      params["UpdateExpression"] += prefix + "#" + attribute + " = :" + attribute
      params["ExpressionAttributeValues"][":" + attribute] = product[attribute]
      params["ExpressionAttributeNames"]["#" + attribute] = attribute
      prefix = ", "
    }
  }
  try {
    await docClient.update(params).promise()
    return product
  } catch (err) {
    console.log('DynamoDB error: ', err)
    return null
  }
}

export default updateProduct
In this function there is logic that will build the UpdateExpression dynamically based on what is passed in. This way, we can allow the user to update N number of items without having to take into consideration how many items are being updated.

productsByCategory.ts
const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

async function productsByCategory(category: string) {
  const params = {
    TableName: process.env.PRODUCT_TABLE,
    IndexName: 'productsByCategory',
    KeyConditionExpression: '#fieldName = :category',
    ExpressionAttributeNames: { '#fieldName': 'category' },
    ExpressionAttributeValues: { ':category': category },
  }

  try {
      const data = await docClient.query(params).promise()
      return data.Items
  } catch (err) {
      console.log('DynamoDB error: ', err)
      return null
  }
}

export default productsByCategory
This function calls a DynamoDB query, querying on the productsByCategory Global Secondary Index, returning an array of items that match the category name passed in as an argument.

Deploying and testing
To see what will be deployed before making changes at any time, you can build the project and run the CDK diff command from the root of the CDK project:

npm run build && cdk diff
Note that if you run this command from another location other than the root of the CDK project, it will not work.

At this point we are ready to deploy the back end. To do so, run the following command from your terminal in the root directory of your CDK project:

npm run build && cdk deploy -O ./cdk-exports.json
Creating a user
Since this is an authenticated API, we need to create a user in order to test out the API.

To create a user, open the Amazon Cognito Dashboard and click on Manage User Pools.

Next, click on the User Pool that starts with cdkproductsuserpool. Be sure that you are in the same region in the AWS Console that you created your project in, or else the User Pool will not show up.

In this dashboard, click Users and groups to create a new user.

Note that you do not need to input a phone number to create a new user.

Creating a user

Creating a group and adding the user to the group
Next, create a new group named "Admins" in the Cognito dashboard.

Creating a group

Next, add the user to the group by clicking on the user and then clicking "Add to group"

Adding a user to a group

Testing in AppSync
Now that the user is created, we can make both authenticated and unauthenticated requests in AppSync.

To test out the API we can use the GraphiQL editor in the AppSync dashboard. To do so, open the AppSync Dashboard and search for cdk-product-api.

Next, click on Queries to open the query editor.

Here, you will be able to choose between public access (API Key) and private access (Amazon Cognito User Pools).

API Authorization

To make any authenticated requests (for mutations or querying by user ID), you will need to sign in using the user you created in the Cognito dashboard:

Signing in

Note that the first time you sign in, you will be prompted to change your password.

In the AppSync dashboard, click on Queries to open the GraphiQL editor. In the editor, create a new product with the following mutation.

Be sure to have the authentication mode set to Amazon Cognito User Pools and sign in with a user that is part of the Admin group in order to execute the following operations: createProduct, deleteProduct, udpateProduct.

mutation createProduct {
  createProduct(product: {
    id: "001"
    category: "Shoes"
    name: "Yeezy Boost"
    description: "The YEEZY BOOST features an upper composed of re-engineered Primeknit."
    price: 300.49
    inventory: 100
  }) {
    id
    category
    description
    name
    price
    inventory
  }
}
Then, query for products:

query listProducts {
  listProducts {
    id
    name
    description
    price
    category
    inventory
  }
}
You can also test out the other operations:

query getProductById {
  getProductById(productId: "001") {
    id
    name
    id
    description
    price
    inventory
  }
}

query productsByCategory {
  productsByCategory(category: "Shoes") {
    id
    inventory
    description
    price
    category
    inventory
    sku
  }
}

mutation updateProduct {
  updateProduct(product: {
    id: "001"
    name: "Yeezy Boost 350"
  }) {
    id
    name
  }
}

mutation deleteProduct {
  deleteProduct(productId: "001")
}
Calling the API from a client project
To authenticated API calls from a client application, the authorization type needs to be specified in the query or mutation. Here is an example of how this looks in JavaScript:

// Using API Key
const listProducts = `
  query listProducts {
    listProducts {
      id
      name
      description
      price
      category
      inventory
    }
  }
`

const products = await API.graphql({
  mutation: listProducts,
  authMode: 'API_KEY'
})

// Authenticated request using Cognito
const createProduct = `
  mutation createProduct($product: ProductInput!) {
    createProduct(product: $product) {
      id
      category
      description
      name
      price
      inventory
    }
  }
`

await API.graphql({
  mutation: createProduct,
  authMode: 'AMAZON_COGNITO_USER_POOLS',
  variables: {
    product
  }
})
To learn more or to see how this is done on Android, iOS or Flutter, check out the documentation here

Removing Services
To delete the project, run the destroy comand:

cdk destroy
