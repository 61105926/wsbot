import {
  BotStateGlobal,
  BotStateStandAlone,
  DispatchFn,
  DynamicBlacklist,
} from "@builderbot/bot/dist/types";
import { BaileysProvider } from "@builderbot/provider-baileys";

export type Bot =
  | (Pick<BaileysProvider, "sendMessage" | "vendor"> & {
      provider: BaileysProvider;
      blacklist: DynamicBlacklist;
      dispatch: DispatchFn;
      state: (number: string) => BotStateStandAlone;
      globalState: () => BotStateGlobal;
    })
  | undefined;
