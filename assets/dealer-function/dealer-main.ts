import createDealer from './create-dealer'
import listDealers from './list-dealers'
import getDealerById from './get-dealer-Id'
import Dealer from './dealer'
import deleteByDealerId from './delete-by-dealerId'

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    dealerId: string,
    brand: string
    dealer: Dealer,
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
      case "createDealer":
         return await createDealer(event.arguments.dealer)
      case "listDealers":
          return await listDealers()
      case "getDealerById":
          return await getDealerById(event.arguments.dealerId)
      case "deleteByDealerId":
          return await deleteByDealerId(event.arguments.dealerId)
      default:
        return "sunspported operation-->"+event.info.fieldName
    }
  };