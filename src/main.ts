import { newClient, EventHandle, Client, configSite } from "./socket";
import {
  RoomBasicParam,
  Message,
  RoomGroupBuying,
  RoomGroupBuyingVote,
  RoomGroupBuyingNextProduct,
  RoomGroupBuyingStart,
  RoomGroupBuyingLotteryOpening,
  RoomGroupBuyingWinning,
  RoomGroupBuyingBiddingCounteroffer,
  RoomGroupBuyingBiddingDeal,
  RoomGroupBuyingBiddingBuyerInitiatesOffer,
  RoomGroupBuyingBiddingSellerReceivesOffer,
  RoomGroupBuyingBiddingSellerCounteroffer,
  RoomGroupBuyingBiddingBuyerOfferRejected,
  RoomDetail
} from "./types";

const url = "ws://47.57.236.213:8849/ws";
const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzaG9wIiwiZXhwIjoxNzMwMTA2NDQ1LCJpYXQiOjE3MjIzMzA0NDUsImp0aSI6IjVkMTMwYTkyZGQ0MzE3ZTFiYWE2NTQ5YjNmNzU0NDgzIn0.QdOiSOjNxMv1sP7MzivqcbNi3bh0AtpU2Y0AGyqauNc";

class MsgCallback implements EventHandle {
  OnRoomDetail(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomDetail>
  ): void {
    // const content = message.content;
    // console.log(`房间详情: 在线人数(${content.onlinePeople}), 时间(${new Date()})`);
  }
  OnRoomGroupBuying(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuying>
  ): void {
    // const content = message.content;
    // console.log(
    //   `房间团购详情: 房间ID(${content.id}), 团购ID(${
    //     content.groupBuyingId
    //   }), 最大可投票数(${content.maxVoteTickets}), 用户最大可投票数(${
    //     content.userMaxVoteTickets
    //   }), 当前已投票数(${content.currentVoteTickets}), 投票进度(${
    //     Number(content.voteProgress) / 100
    //   })`
    // );
  }
  OnRoomGroupBuyingVote(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingVote>
  ): void {
    const content = message.content;
    console.log(
      `房间团购投票: 团购ID(${content.groupBuyingId}), 用户ID(${content.userId}), 投票时间(${content.voteTime}), 投票数(${content.tickets})`
    );
  }
  OnRoomGroupBuyingNextProduct(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingNextProduct>
  ): void {
    const content = message.content;
    if (content.beginTime == BigInt(0)) {
      console.log(
        `房间团购下一轮商品: 团购ID(${content.groupBuyingId}), 商品ID(${content.productId}), SKUID(${content.skuId})`
      );
    } else {
      console.log(`房间团购下一轮商品: 开始时间(${content.beginTime})`);
    }
  }
  OnRoomGroupBuyingStart(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingStart>
  ): void {
    console.log("房间团购开始");
  }
  OnRoomGroupBuyingLotteryOpening(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingLotteryOpening>
  ): void {
    console.log("房间团购开奖中");
  }
  OnRoomGroupBuyingWinning(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingWinning>
  ): void {
    const content = message.content;
    console.log(
      `房间团购用户中奖: 用户ID(${content.winnerUserId}), 奖品可领奖时间(${content.prizeCollectionTime}), 竞拍ID(${content.auctionId})`
    );
  }
  OnRoomGroupBuyingBiddingCounteroffer(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingCounteroffer>
  ): void {
    console.log("房间团购竞拍还价所有人");
  }
  OnRoomGroupBuyingBiddingDeal(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingDeal>
  ): void {
    console.log("房间团购竞拍成交");
  }
  OnRoomGroupBuyingBiddingBuyerInitiatesOffer(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingBuyerInitiatesOffer>
  ): void {
    console.log("房间团购竞拍买家发起报价");
  }
  OnRoomGroupBuyingBiddingSellerReceivesOffer(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingSellerReceivesOffer>
  ): void {
    console.log("房间团购竞拍买家收到报价");
  }
  OnRoomGroupBuyingBiddingSellerCounteroffer(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingSellerCounteroffer>
  ): void {
    console.log("房间团购竞拍买家收到还价");
  }
  OnRoomGroupBuyingBiddingBuyerOfferRejected(
    client: Client,
    param: RoomBasicParam,
    message: Message<RoomGroupBuyingBiddingBuyerOfferRejected>
  ): void {
    console.log("房间团购竞拍买家报价被拒");
  }
}

function main() {
  process.title = "WoohaSocketSDK";
  demo();
}

export function demo() {
  // configSite("127.0.0.1:8849");
  const client = newClient(new MsgCallback(), token, true);
  client.start();
  client.enterRoom(BigInt(1));
}

if (require.main === module) {
  main();
}
