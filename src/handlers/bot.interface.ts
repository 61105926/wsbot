import {
  BotStateGlobal,
  BotStateStandAlone,
  DispatchFn,
  DynamicBlacklist,
} from "@builderbot/bot/dist/types";
import { BaileysProvider as Provider } from 'builderbot-provider-sherpa';


export type Bot =
  | (Pick<Provider, "sendMessage" | "vendor"> & {
      provider: Provider;
      blacklist: DynamicBlacklist;
      dispatch: DispatchFn;
      state: (number: string) => BotStateStandAlone;
      globalState: () => BotStateGlobal;
    })
  | undefined;
