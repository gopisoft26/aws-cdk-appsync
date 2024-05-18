const ddb = require("@aws-cdk/aws-dynamodb");
async function getProductById(productId: string) {
    const params = {
        TableName: process.env.PRODUCT_TABLE,
        Key: { id: productId }
    }
    try {
        const { Item } = await ddb.get(params).promise()
        return Item
    } catch (err) {
        console.log('DynamoDB error: ', err)
    }
}

export default getProductById