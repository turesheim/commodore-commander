import {
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices
} from 'langium';
import {
  createDefaultModule,
  createDefaultSharedModule,
  type LangiumServices,
  type LangiumSharedServices
} from 'langium/lsp';

import {
  KickAssemblerOutlineGeneratedModule,
  KickAssemblerOutlineGeneratedSharedModule
} from './generated/module.ts';

export interface KickAssemblerOutlineServicesBundle {
  shared: LangiumSharedServices & LangiumSharedCoreServices;
  outline: LangiumServices & LangiumCoreServices;
}

let servicesBundle: KickAssemblerOutlineServicesBundle | undefined;

export function getKickAssemblerOutlineServices(): KickAssemblerOutlineServicesBundle {
  if (servicesBundle) {
    return servicesBundle;
  }

  const shared = inject(
    createDefaultSharedModule(EmptyFileSystem),
    KickAssemblerOutlineGeneratedSharedModule
  );
  const outline = inject(
    createDefaultModule({ shared }),
    KickAssemblerOutlineGeneratedModule
  );

  shared.ServiceRegistry.register(outline);
  servicesBundle = {
    shared,
    outline
  };

  return servicesBundle;
}
