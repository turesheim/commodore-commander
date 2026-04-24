import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

import {
  COMMODORE_COMMANDER_APPLICATION_ID,
  ensureCommodoreCommanderBranding
} from './commodore-commander-branding';

@injectable()
export class CommodoreCommanderFrontendContribution implements FrontendApplicationContribution {
  onStart(_app: FrontendApplication): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.document.body.dataset.applicationId = COMMODORE_COMMANDER_APPLICATION_ID;
    ensureCommodoreCommanderBranding(window.document);
  }
}
