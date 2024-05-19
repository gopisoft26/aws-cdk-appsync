import Dealer from "./dealer";
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const ddb = new AWS.DynamoDB.DocumentClient();

async function createDealer(dealer: Dealer) {
    if (!dealer.id) {
        dealer.id = uuidv4(); // random id
    }
    const params = {
      TableName: process.env.DEALER_TABLE,
      Item: dealer
    }
    try {
      await ddb.put(params).promise()
      return dealer
    } catch (err) {
      console.log('DynamoDB error: ', err)
      return null
    }
  }
  
  export default createDealer