const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

async function deleteByDealerId(dealerId:any) {
    const params = {
        TableName: process.env.DEALER_TABLE,
        Key: { id: dealerId }
    };

    try {
        await ddb.delete(params).promise();
    
        return {
          success: true,
          message: `Item with id ${dealerId} deleted successfully`
        };
    } catch (error) {
        return {
          success: false,
          message: `Failed to delete item with id ${dealerId}`
        };
    }
}

export default deleteByDealerId;
