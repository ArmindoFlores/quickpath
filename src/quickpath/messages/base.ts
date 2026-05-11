import OBR from "@owlbear-rodeo/sdk";
import { constants } from "../../constants";
import { uniqueId } from "lodash";
import type { MessageEvent, QuickpathMessageBase, QuickpathMessageError, QuickpathMessageResponse } from "./types";

function isErrorMessage(message: QuickpathMessageBase): message is QuickpathMessageError {
    return typeof (message as QuickpathMessageError).error === "string";
}

export function handleError(connectionId: string, message: QuickpathMessageBase, error: string) {
    console.error(error);
    OBR.broadcast.sendMessage(
        constants.OUTBOUND_MESSAGE_CHANNEL_ID,
        {id: message.id, recipient: connectionId, error: error},
        {destination: "ALL"}
    );
}

export function makeMessageBasedAPI<A extends QuickpathMessageBase, R>(type: A["type"]) {
    async function api(args: Omit<A, "type"|"id">): Promise<R> {
        const selfConnectionId = await OBR.player.getConnectionId();
        const messageId = uniqueId("message-");
    
        return await new Promise((resolve, reject) => {
            let unsubscribe: (() => void) | undefined = undefined;
    
            function cb(event: MessageEvent) {
                const { data, connectionId } = event;
                const message = data as QuickpathMessageResponse<R> | QuickpathMessageError;
    
                if (connectionId != selfConnectionId || message.id !== messageId) return;
    
                unsubscribe!();
    
                if (isErrorMessage(message)) {
                    reject(message.error);
                }
                else {
                    resolve(message.result);
                }
            }
        
            unsubscribe = OBR.broadcast.onMessage(constants.OUTBOUND_MESSAGE_CHANNEL_ID, cb);
            OBR.broadcast.sendMessage(
                constants.BASE_MESSAGE_CHANNEL_ID,
                {
                    id: messageId,
                    type,
                    ...args
                },
                {destination: "ALL"}
            );
        });
    }
    return api;
}
