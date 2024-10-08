"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFuket = void 0;
//@ts-ignore
const plus_websocket_1 = __importDefault(require("plus-websocket"));
const types_1 = require("./types");
const constants_1 = __importDefault(require("./constants"));
class WebFuket {
    constructor(url, token, platform = constants_1.default.Platform) {
        this.url = url;
        this.token = token;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this.platform = platform;
        const protocols = [];
        if (this.token) {
            protocols.push("token");
            protocols.push(this.token);
        }
        console.log("process.env['UNI_PLATFORM']", this.platform);
        if (this.platform === types_1.PlatformType.UniApp) {
            //@ts-ignore
            Object.assign(uni, plus_websocket_1.default);
            //@ts-ignore
            this.socket = uni.connectSocket({
                url: this.url,
                header: { "content-type": "application/json" },
                protocols: protocols,
                method: "GET",
                complete: () => { },
                success: () => {
                    setTimeout(() => {
                        if (this.onopen)
                            this.onopen(null);
                    }, 100);
                },
                fail: () => {
                    setTimeout(() => {
                        if (this.onclose)
                            this.onclose(null);
                    }, 100);
                }
            });
            this.socket.onOpen(() => {
                if (this.onopen)
                    this.onopen(null);
            });
            this.socket.onMessage((ev) => {
                if (this.onmessage)
                    this.onmessage(ev);
            });
            this.socket.onError((ev) => {
                if (this.onerror)
                    this.onerror(ev);
            });
            this.socket.onClose((ev) => {
                if (this.onclose)
                    this.onclose(ev);
            });
        }
        else {
            this.socket = new WebSocket(this.url, protocols);
            this.socket.onopen = (ev) => {
                if (this.onopen)
                    this.onopen(ev);
            };
            this.socket.onmessage = (ev) => {
                if (this.onmessage)
                    this.onmessage(ev);
            };
            this.socket.onerror = (ev) => {
                if (this.onerror)
                    this.onerror(ev);
            };
            this.socket.onclose = (ev) => {
                if (this.onclose)
                    this.onclose(ev);
            };
        }
    }
    close() {
        this.socket.close();
    }
    send(data) {
        if (this.platform === types_1.PlatformType.UniApp) {
            this.socket.send({ data });
            return;
        }
        this.socket.send(data);
    }
}
exports.WebFuket = WebFuket;
//# sourceMappingURL=socket_impl.js.map