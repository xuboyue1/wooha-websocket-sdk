import {
  RequestMessage,
  RoomParam,
  ChannelType,
  ResponseMessage,
  Message,
  MessageType,
  Room,
  GroupBuying,
  GroupBuyingVote,
  GroupBuyingNextProduct,
  GroupBuyingStart,
  GroupBuyingLotteryOpening,
  GroupBuyingWinning,
  BiddingAllCounteroffer,
  BiddingDeal,
  UserBiddingInitiateOffer,
  UserBiddingReceivesOffer,
  UserBiddingReceivesCounteroffer,
  UserBiddingRejectedOffer
} from "./types";
import { WebFuket } from "./socket_impl";
import { pack, unpack } from "msgpackr";

function uuid(): string {
  return `${Date.now()}${Math.random()}`;
}

// ============================================================ //
// 全局配置
// ============================================================ //

// 站点
let site = "47.57.236.213:8849";
// 使用HTTPS
let enableHttps = false;
// 使用WSS
let enableWss = false;

// 设置站点
export function configSite(url: string) {
  site = url;
}

// 使用HTTPS
export function useHttps() {
  enableHttps = true;
}

// 使用WSS
export function useWss() {
  enableWss = true;
}

function getBasicWebsocketUrl(): string {
  if (enableWss) {
    return `wss://${site}`;
  } else {
    return `ws://${site}`;
  }
}

function getBasicHttpUrl(): string {
  if (enableHttps) {
    return `https://${site}`;
  } else {
    return `http://${site}`;
  }
}

/// 客户端
export interface Client {
  /// 启动
  start(): Client;
  /// 停止
  stop(autoConn?: boolean): Client;
  /// 进入聚合房间
  enterAggRoom(): Promise<Client>;
  /// 离开聚合房间
  leaveAggRoom(): Client;
  /// 进入房间
  enterRoom(roomId: bigint): Promise<Client>;
  /// 离开房间
  leaveRoom(roomId: bigint): Client;
}

export enum Platform {
  WEB= 'web',
    UniApp= 'uni-app'
}

/// 事件
export interface EventHandle {
  /// 房间详情
  OnRoom(client: Client, param: RoomParam, message: Message<Room>, response: ResponseMessage): void;
  /// 团购详情
  OnGroupBuying(client: Client, param: RoomParam, message: Message<GroupBuying>, response: ResponseMessage): void;
  /// 团购投票
  OnGroupBuyingVote(
    client: Client,
    param: RoomParam,
    message: Message<GroupBuyingVote>,
    response: ResponseMessage
  ): void;
  /// 团购下一个商品
  OnGroupBuyingNextProduct(
    client: Client,
    param: RoomParam,
    message: Message<GroupBuyingNextProduct>,
    response: ResponseMessage
  ): void;
  /// 团购开始
  OnGroupBuyingStart(
    client: Client,
    param: RoomParam,
    message: Message<GroupBuyingStart>,
    response: ResponseMessage
  ): void;
  /// 团购正在开奖
  OnGroupBuyingLotteryOpening(
    client: Client,
    param: RoomParam,
    message: Message<GroupBuyingLotteryOpening>,
    response: ResponseMessage
  ): void;
  /// 团购中奖
  OnGroupBuyingWinning(
    client: Client,
    param: RoomParam,
    message: Message<GroupBuyingWinning>,
    response: ResponseMessage
  ): void;
  /// 竞拍还价所有人
  OnBiddingAllCounteroffer(
    client: Client,
    param: RoomParam,
    message: Message<BiddingAllCounteroffer>,
    response: ResponseMessage
  ): void;
  /// 竞拍成交
  OnBiddingDeal(client: Client, param: RoomParam, message: Message<BiddingDeal>, response: ResponseMessage): void;
  /// 用户竞拍买家发起报价(私人)
  OnUserBiddingInitiateOffer(
    client: Client,
    param: RoomParam,
    message: Message<UserBiddingInitiateOffer>,
    response: ResponseMessage
  ): void;
  /// 用户竞拍卖家收到报价(私人)
  OnUserBiddingReceivesOffer(
    client: Client,
    param: RoomParam,
    message: Message<UserBiddingReceivesOffer>,
    response: ResponseMessage
  ): void;
  /// 用户竞拍买家收到还价(私人)
  OnUserBiddingReceivesCounteroffer(
    client: Client,
    param: RoomParam,
    message: Message<UserBiddingReceivesCounteroffer>,
    response: ResponseMessage
  ): void;
  /// 用户竞拍买家报价被拒(私人)
  OnUserBiddingRejectedOffer(
    client: Client,
    param: RoomParam,
    message: Message<UserBiddingRejectedOffer>,
    response: ResponseMessage
  ): void;
}

export class RequestInfo {
  /// 请求配置
  public config: RequestMessage;
  /// 请求间隔(毫秒)
  public interval: number;
  /// 下一次请求时间(毫秒)
  public nextRequestTime: number;
  /// 是否为增量数据
  public isIncrData: boolean;

  constructor(config: RequestMessage, interval: number, isIncrData: boolean = true) {
    const now = Date.now();
    this.nextRequestTime = now;
    this.interval = interval;
    this.config = config;
    this.isIncrData = isIncrData;
  }
}

export class ClientProvider implements Client {
  private socket: WebFuket | null = null;
  private url: string;
  private token?: string;
  private lastReqTime: number;
  private lastRpsTime: number;
  private autoConn: boolean;
  private isRunning: boolean;
  private interval: NodeJS.Timeout | null;
  private callback: EventHandle;
  private requests: RequestInfo[];
  private showLog: boolean;
  private platform: Platform;

  constructor(eventHandle: EventHandle, token?: string, showLog: boolean = false, platform: Platform = Platform.UniApp) {
    this.url = getBasicWebsocketUrl() + "/ws";
    this.token = token;
    this.lastReqTime = 0;
    this.lastRpsTime = 0;
    this.autoConn = true;
    this.isRunning = false;
    this.interval = null;
    this.callback = eventHandle;
    this.requests = [];
    this.showLog = showLog;
    this.platform = platform;
    // 5秒心跳
    this.registerChannel(
      <RequestMessage>{
        channel: ChannelType.HEARTBEAT,
        version: "1.0",
        seq: BigInt(0),
        ts: BigInt(Date.now()),
        uid: uuid()
      },
      5000,
      false
    );
  }

  start(): Client {
    this.stop();

    const now = Date.now();
    this.lastReqTime = now;
    this.lastRpsTime = now;

    this.socket = new WebFuket(this.url, this.token, this.platform);

    this.socket.onopen = this.onOpen.bind(this);
    this.socket.onclose = this.onClose.bind(this);
    this.socket.onmessage = this.onMessage.bind(this);
    this.socket.onerror = this.onError.bind(this);

    this.interval = setInterval(this.handle.bind(this), 100);

    this.requests.forEach((item) => {
      item.nextRequestTime = now;
    });

    return this;
  }

  stop(autoConn: boolean = true): Client {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      if (this.showLog) console.error("Websocket已断开");
      this.isRunning = false;
      clearInterval(this.interval!);
      this.interval = null;
    }
    this.autoConn = autoConn;
    return this;
  }

  registerChannel(config: RequestMessage, interval: number, isIncrData?: boolean) {
    this.requests.push(new RequestInfo(config, interval, isIncrData));
  }

  async enterAggRoom(): Promise<Client> {
    try {
      // 订阅房间聚合消息
      const roomAggMsgSeq = await this.getMsgSeqByRank(ChannelType.ROOM_AGG_MSG, 1, {}, this.token);
      if (this.showLog) {
        console.log(`订阅房间聚合消息: 版本号(${roomAggMsgSeq})`);
      }
      this.registerChannel(
        <RequestMessage>{
          channel: ChannelType.ROOM_AGG_MSG,
          version: "1.0",
          seq: BigInt(roomAggMsgSeq),
          ts: BigInt(Date.now()),
          uid: uuid(),
          params: {}
        },
        100
      );
      if (this.token) {
        // 订阅用户房间聚合消息
        const userRoomAggMsgSeq = await this.getMsgSeqByRank(ChannelType.USER_ROOM_AGG_MSG, 1, {}, this.token);
        if (this.showLog) {
          console.log(`订阅用户房间聚合消息: 版本号(${userRoomAggMsgSeq})`);
        }
        this.registerChannel(
          <RequestMessage<RoomParam>>{
            channel: ChannelType.USER_ROOM_AGG_MSG,
            version: "1.0",
            seq: BigInt(userRoomAggMsgSeq),
            ts: BigInt(Date.now()),
            uid: uuid(),
            params: {}
          },
          100
        );
      }
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  leaveAggRoom(): Client {
    this.requests = this.requests.filter(
      (request) => ![ChannelType.ROOM_AGG_MSG, ChannelType.USER_ROOM_AGG_MSG].includes(request.config.channel)
    );
    return this;
  }

  async enterRoom(roomId: bigint): Promise<Client> {
    try {
      // 订阅房间详情
      this.registerChannel(
        <RequestMessage<RoomParam>>{
          channel: ChannelType.ROOM,
          version: "1.0",
          seq: BigInt(0),
          ts: BigInt(Date.now()),
          uid: uuid(),
          params: { roomId }
        },
        3000,
        false
      );
      // 订阅团购详情
      const groupBuyingSeq = await this.getMsgSeqByRank(ChannelType.GROUPBUYING, 1, { roomId }, this.token);
      if (this.showLog) {
        console.log(`订阅团购详情: roomId(${roomId}), 版本号(${groupBuyingSeq})`);
      }
      this.registerChannel(
        <RequestMessage<RoomParam>>{
          channel: ChannelType.GROUPBUYING,
          version: "1.0",
          seq: BigInt(groupBuyingSeq),
          ts: BigInt(Date.now()),
          uid: uuid(),
          params: { roomId }
        },
        100
      );
      // 订阅团购投票
      const groupBuyingVoteSeq = await this.getMsgSeqByRank(ChannelType.GROUPBUYING_VOTE, 1, { roomId }, this.token);
      if (this.showLog) {
        console.log(`订阅团购投票: roomId(${roomId}), 版本号(${groupBuyingVoteSeq})`);
      }
      this.registerChannel(
        <RequestMessage<RoomParam>>{
          channel: ChannelType.GROUPBUYING_VOTE,
          version: "1.0",
          seq: BigInt(groupBuyingVoteSeq),
          ts: BigInt(Date.now()),
          uid: uuid(),
          params: { roomId }
        },
        100
      );
      // 订阅房间消息
      const roomMsgSeq = await this.getMsgSeqByRank(ChannelType.ROOM_MSG, 1, { roomId }, this.token);
      if (this.showLog) {
        console.log(`订阅房间消息: roomId(${roomId}), 版本号(${roomMsgSeq})`);
      }
      this.registerChannel(
        <RequestMessage<RoomParam>>{
          channel: ChannelType.ROOM_MSG,
          version: "1.0",
          seq: BigInt(roomMsgSeq),
          ts: BigInt(Date.now()),
          uid: uuid(),
          params: { roomId }
        },
        100
      );
      if (this.token) {
        // 订阅用户房间消息
        const userRoomMsgSeq = await this.getMsgSeqByRank(ChannelType.USER_ROOM_MSG, 1, { roomId }, this.token);
        if (this.showLog) {
          console.log(`订阅用户房间消息: roomId(${roomId}), 版本号(${userRoomMsgSeq})`);
        }
        this.registerChannel(
          <RequestMessage<RoomParam>>{
            channel: ChannelType.USER_ROOM_MSG,
            version: "1.0",
            seq: BigInt(userRoomMsgSeq),
            ts: BigInt(Date.now()),
            uid: uuid(),
            params: { roomId }
          },
          100
        );
      }
    } catch (e) {
      console.error(e);
    }
    return this;
  }

  leaveRoom(roomId: bigint): Client {
    this.requests = this.requests.filter(
      (request) =>
        !(
          [
            ChannelType.ROOM_MSG,
            ChannelType.ROOM,
            ChannelType.GROUPBUYING,
            ChannelType.GROUPBUYING_VOTE,
            ChannelType.USER_ROOM_MSG
          ].includes(request.config.channel) && (<RoomParam>request.config.params).roomId === roomId
        )
    );
    return this;
  }

  private onOpen(): void {
    if (this.showLog) console.log("Websocket已连接");
    this.isRunning = true;
  }

  private onClose(): void {
    this.stop();
    if (this.autoConn) {
      setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    if (typeof event.data === "string") {
      console.error("Websocket异常:", JSON.parse(event.data));
      return;
    }
    const now = Date.now();
    this.lastRpsTime = now;
    var rpsData;
    if (this.platform === Platform.UniApp) {
      rpsData = new Uint8Array(event.data);
    } else {
      rpsData = new Uint8Array(await event.data.arrayBuffer());
    }
    const responses = unpack(rpsData) as ResponseMessage[];
    if (this.showLog)
      console.log(
        "🌟接收消息:",
        responses.map((itme) => ChannelType[itme.channel]).join(", "),
        rpsData.length,
        "Bytes"
      );
    for (const response of responses) {
      const request = this.requests.find((request) => request.config.uid === response.uid);
      if (!request) continue;

      if (request.isIncrData) {
        if (request.config.seq >= response.rpsSeq) continue;
      }

      switch (response.channel) {
        case ChannelType.ROOM:
          for (const message of response.contents) {
            this.callback.OnRoom(this, request.config.params, message, response);
          }
          break;
        case ChannelType.GROUPBUYING:
          for (const message of response.contents) {
            this.callback.OnGroupBuying(this, request.config.params, message, response);
          }
          break;
        case ChannelType.ROOM_MSG:
        case ChannelType.ROOM_AGG_MSG:
          for (const message of response.contents) {
            switch (message.type) {
              case MessageType.GROUPBUYING_NEXT_PRODUCT:
                this.callback.OnGroupBuyingNextProduct(this, request.config.params, message, response);
                break;
              case MessageType.GROUPBUYING_START:
                this.callback.OnGroupBuyingStart(this, request.config.params, message, response);
                break;
              case MessageType.GROUPBUYING_LOTTERY_OPENING:
                this.callback.OnGroupBuyingLotteryOpening(this, request.config.params, message, response);
                break;
              case MessageType.GROUPBUYING_WINNING:
                this.callback.OnGroupBuyingWinning(this, request.config.params, message, response);
                break;
              case MessageType.BIDDING_ALL_COUNTEROFFER:
                this.callback.OnBiddingAllCounteroffer(this, request.config.params, message, response);
                break;
              case MessageType.BIDDING_DEAL:
                this.callback.OnBiddingDeal(this, request.config.params, message, response);
                break;
            }
          }
          break;
        case ChannelType.GROUPBUYING_VOTE:
          for (const message of response.contents) {
            this.callback.OnGroupBuyingVote(this, request.config.params, message, response);
          }
          break;
        case ChannelType.USER_ROOM_MSG:
        case ChannelType.USER_ROOM_AGG_MSG:
          for (const message of response.contents) {
            switch (message.type) {
              case MessageType.USER_BIDDING_INITIATE_OFFER:
                this.callback.OnUserBiddingInitiateOffer(this, request.config.params, message, response);
                break;
              case MessageType.USER_BIDDING_RECEIVES_OFFER:
                this.callback.OnUserBiddingReceivesOffer(this, request.config.params, message, response);
                break;
              case MessageType.USER_BIDDING_RECEIVES_COUNTEROFFER:
                this.callback.OnUserBiddingReceivesCounteroffer(this, request.config.params, message, response);
                break;
              case MessageType.USER_BIDDING_REJECTED_OFFER:
                this.callback.OnUserBiddingRejectedOffer(this, request.config.params, message, response);
                break;
            }
          }
          break;
        case ChannelType.HEARTBEAT:
          // console.log("收到服务器心跳:", now);
          break;
      }
      request.config.seq = response.rpsSeq;
    }
  }

  private onError(event: Event): void {
    if (this.showLog) console.error("Websocket连接出现错误:", event);
  }

  private isTimeout(): boolean {
    const now = Date.now();
    if (this.lastReqTime + 18000 > now) return false;
    if (this.lastRpsTime + 18000 > now) return false;
    return true;
  }

  private handle(): void {
    if (!this.isRunning) return;
    if (this.isTimeout()) {
      if (this.showLog) console.error("连接超时");
      this.stop();
      return;
    }

    if (this.requests.length == 0) return;

    const now = Date.now();
    const requests = [];

    for (const request of this.requests) {
      if (request.nextRequestTime > now) continue;
      request.nextRequestTime = now + request.interval;
      requests.push(request.config);
    }

    if (requests.length == 0) return;

    const sendData = pack(requests);
    if (this.showLog)
      console.log(
        "⏫发送消息:",
        requests.map((itme) => ChannelType[itme.channel]).join(", "),
        sendData.length,
        "Bytes"
      );
    this.socket?.send(sendData);
    this.lastReqTime = now;
  }
  async getMsgSeqByRank(
      channel: ChannelType,
      rank: number = 1,
      params: Record<string, any> = {},
      token?: string
  ): Promise<string> {
    const headers: Record<string, any> = {
      "Content-Type": "application/json"
    };
    if (token) headers["token"] = token;

    const url = `${getBasicHttpUrl()}/getMessageVersioinByRank?`;
    const queryString = objectToQueryString(Object.assign(params, { channel, rank }));
    if (this.platform === Platform.UniApp) {
      return new Promise((resolve, reject) => {
        //@ts-ignore
        uni.request({
          url: `${url}${queryString}`,
          header: headers,
          success: (res: any) => {
            resolve(res.data.data);
          },
          fail: () => {
            reject();
          }
        });
      });
    } else {
      return fetch(`${url}${queryString}`, {
        method: "GET",
        headers
      })
          .then((res) => res.json())
          .then((json) => json.data);
    }
  }
}

export function newClient(eventHandle: EventHandle, token?: string, showLog?: boolean): Client {
  return new ClientProvider(eventHandle, token, showLog);
}

function objectToQueryString(obj: any) {
  const params = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      params.push(`${key}=${obj[key]}`);
    }
  }
  return params.join("&");
}

// function uint8ArrayToHex(uint8Array: any) {
//   return Array.from(uint8Array, (byte: any) => byte.toString(16).padStart(2, "0")).join("");
// }
