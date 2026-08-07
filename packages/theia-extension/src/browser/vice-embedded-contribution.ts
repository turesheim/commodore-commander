import {
    FrontendApplication,
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { injectable } from '@theia/core/shared/inversify';

import {
    VICE_EMBEDDED_WIDGET_ID,
    ViceEmbeddedWidget
} from './vice-embedded-widget';

@injectable()
export class ViceEmbeddedContribution
    extends AbstractViewContribution<ViceEmbeddedWidget>
    implements FrontendApplicationContribution {
    constructor() {
        super({
            widgetId: VICE_EMBEDDED_WIDGET_ID,
            widgetName: 'VICE',
            defaultWidgetOptions: {
                area: 'right',
                rank: 200
            },
            toggleCommandId: 'commodoreCommander.viceEmbedded.toggle'
        });
    }

    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        await this.openView({ reveal: true });
    }
}
