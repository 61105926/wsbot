import {
  BotStateGlobal,
  BotStateStandAlone,
  DispatchFn,
  DynamicBlacklist,
} from "@builderbot/bot/dist/types";
import type { BaileysProvider as ProviderType } from 'aurik3-builderbot-baileys-custom';
import { BaileysProvider as Provider } from 'aurik3-builderbot-baileys-custom';


export type Bot =
  | (Pick<ProviderType, "sendMessage" | "vendor"> & {
      provider: ProviderType;
      blacklist: DynamicBlacklist;
      dispatch: DispatchFn;
      state: (number: string) => BotStateStandAlone;
      globalState: () => BotStateGlobal;
    })
  | undefined;

