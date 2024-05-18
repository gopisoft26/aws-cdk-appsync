import { Product } from "./product"
const ddb = require("@aws-cdk/aws-dynamodb");

async function createProduct(product: Product) {
    if (!product.id) {
      product.id = "12345";
    }
    const params = {
      TableName: process.env.PRODUCT_TABLE,
      Item: product
    }
    try {
      await ddb.put(params).promise()
      return product
    } catch (err) {
      console.log('DynamoDB error: ', err)
      return null
    }
  }
  
  export default createProduct