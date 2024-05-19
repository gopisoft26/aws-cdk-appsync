const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
async function deleteByDealerId(dealerId: any) {
    const params = {
        TableName: process.env.DEALER_TABLE,
        Key: { id: dealerId }
    }
    ddb.delete(params, (err:any, data:any) => {
        if (err) {
            return {
                message: true,
            };
        } else {
            return {
                message: false,
            };
        }
    });

}

export default deleteByDealerId