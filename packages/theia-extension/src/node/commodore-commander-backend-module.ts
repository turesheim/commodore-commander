import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { ContainerModule } from '@theia/core/shared/inversify';
import { DebugAdapterContribution } from '@theia/debug/lib/common/debug-model';

import {
  KickAssemblerBuildServicePath,
  type KickAssemblerBuildClient
} from '../common/kick-assembler-build-service';
import {
  CommodorePrgServicePath
} from '../common/commodore-prg-service';
import {
  SidScoreRuntimeServicePath,
  type SidScoreRuntimeClient
} from '../common/sidscore-runtime-service';
import { CommodorePrgServiceImpl } from './commodore-prg-service-impl';
import { KickAssemblerBuildServiceImpl } from './kick-assembler-build-service-impl';
import { SidScoreRuntimeServiceImpl } from './sidscore-runtime-service-impl';
import { CommodoreViceDebugAdapterContribution } from './commodore-vice-debug-adapter-contribution';

export default new ContainerModule((bind) => {
  bind(CommodorePrgServiceImpl).toSelf().inSingletonScope();
  bind(KickAssemblerBuildServiceImpl).toSelf().inSingletonScope();
  bind(SidScoreRuntimeServiceImpl).toSelf().inSingletonScope();
  bind(BackendApplicationContribution).toService(SidScoreRuntimeServiceImpl);
  bind(CommodoreViceDebugAdapterContribution).toSelf().inSingletonScope();
  bind(DebugAdapterContribution).toService(CommodoreViceDebugAdapterContribution);
  bind(ConnectionHandler)
    .toDynamicValue((context) =>
      new RpcConnectionHandler<KickAssemblerBuildClient>(
        KickAssemblerBuildServicePath,
        (client) => {
          const service = context.container.get(KickAssemblerBuildServiceImpl);
          service.setClient(client);
          return service;
        }
      )
    )
    .inSingletonScope();
  bind(ConnectionHandler)
    .toDynamicValue((context) =>
      new RpcConnectionHandler(
        CommodorePrgServicePath,
        () => context.container.get(CommodorePrgServiceImpl)
      )
    )
    .inSingletonScope();
  bind(ConnectionHandler)
    .toDynamicValue((context) =>
      new RpcConnectionHandler<SidScoreRuntimeClient>(
        SidScoreRuntimeServicePath,
        (client) => {
          const service = context.container.get(SidScoreRuntimeServiceImpl);
          service.setClient(client);
          return service;
        }
      )
    )
    .inSingletonScope();
});
