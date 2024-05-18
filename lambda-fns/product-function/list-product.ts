const ddb = require("@aws-cdk/aws-dynamodb");

async function listProducts() {
  const params = {
      TableName: process.env.PRODUCT_TABLE,
  }
  try {
      const data = await ddb.scan(params).promise()
      return data.Items
  } catch (err) {
      console.log('DynamoDB error: ', err)
      return null
  }
}

export default listProducts