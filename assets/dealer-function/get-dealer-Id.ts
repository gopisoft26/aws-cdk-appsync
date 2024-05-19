const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
async function getDealerById(dealerId: string) {
    const params = {
        TableName: process.env.DEALER_TABLE,
        Key: { id: dealerId }
    }
    try {
        const { Item } = await ddb.get(params).promise()
        return Item
    } catch (err) {
        console.log('DynamoDB error: ', err)
    }
}

export default getDealerById