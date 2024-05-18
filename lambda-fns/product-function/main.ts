import createProduct from './create-product'
import listProducts from './list-product'
import getProductByID from './getProductByID'
import Product from './product'

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

exports.handler = async (event :AppSyncEvent) => {
    console.log('request-gopi123:', JSON.stringify(event, undefined, 2));
    switch (event.info.fieldName) {
      case "getProductById":
        return await getProductByID(event.arguments.productId)
      case "createProduct":
        return await createProduct(event.arguments.product)
      case "listProducts":
        return await listProducts()
      default:
        return null
    }
  };