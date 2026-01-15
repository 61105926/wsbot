import {
  BotStateGlobal,
  BotStateStandAlone,
  DispatchFn,
  DynamicBlacklist,
} from "@builderbot/bot/dist/types";
import type { SendWaveProvider as ProviderType } from '@gamastudio/sendwave-provider';
import { SendWaveProvider as Provider } from '@gamastudio/sendwave-provider';


export type Bot =
  | (Pick<ProviderType, "sendMessage" | "vendor"> & {
      provider: ProviderType;
      blacklist: DynamicBlacklist;
      dispatch: DispatchFn;
      state: (number: string) => BotStateStandAlone;
      globalState: () => BotStateGlobal;
    })
  | undefined;

