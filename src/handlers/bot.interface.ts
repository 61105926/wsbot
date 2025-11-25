import {
  BotStateGlobal,
  BotStateStandAlone,
  DispatchFn,
  DynamicBlacklist,
} from "@builderbot/bot/dist/types";
import type { BaileysProvider as ProviderType } from 'builderbot-provider-sherpa';
import { BaileysProvider as Provider } from '../providers/sherpaProvider';


export type Bot =
  | (Pick<ProviderType, "sendMessage" | "vendor"> & {
      provider: ProviderType;
      blacklist: DynamicBlacklist;
      dispatch: DispatchFn;
      state: (number: string) => BotStateStandAlone;
      globalState: () => BotStateGlobal;
    })
  | undefined;
