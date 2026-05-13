import { APIHandler } from "@armindoflores/obr-ext-core";
import { constants } from "../../constants";
import type { QuickpathMessageRegistry } from "./types";

export const api = new APIHandler<QuickpathMessageRegistry>(
    constants.OUTBOUND_MESSAGE_CHANNEL_ID,
    constants.BASE_MESSAGE_CHANNEL_ID
);
