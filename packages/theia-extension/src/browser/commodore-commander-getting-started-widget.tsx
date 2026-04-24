import { codicon } from '@theia/core/lib/browser';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';

import {
  BUNDLED_DOCUMENTS,
  openBundledDocumentationPreview
} from './commodore-commander-bundled-docs';
import { COMMODORE_COMMANDER_APP_ICON_URL } from './commodore-commander-branding';

// Source: net.sourceforge.vice/about.properties.
const VICE_BRANDING = {
  name: 'Versatile Commodore Emulator',
  shortName: 'VICE',
  version: '3.9',
  description:
    'An emulator supporting C64, the C64DTV, the C128, the VIC20, practically all PET models, the PLUS4 and the CBM-II (aka C610/C510). An extra emulator is provided for C64 expanded with the CMD SuperCPU.',
  copyright:
    "The VICE is copyrighted to: Pottendo, Marco van den Heuvel, Fabrizio Gennari, Groepaz, Errol Smith, Ingo Korb, Olaf Seibert, Marcus Sutton, Kajtar Zsolt, AreaScout, Bas Wassink, Michael C. Martin, Christopher Phillips, David Hogan, Empathic Qubit, Roberto Muscedere, June Tate-Gans, Pablo Roldan, Stefan Haubenthal, BSzili, Andreas Matthies, Daniel Kahlin, Benjamin 'BeRo' Rosseaux, Ulrich Schulz, Thomas Giesel, Antti S. Lankila, Christian Vogelgsang, Dag Lem, Spiro Trikaliotis, Hannu Nuotio, Andreas Boose, Tibor Biczo, M. Kiesel, Andreas Dehmel, David Hansel, Markus Brenner, Thomas Bretz, Daniel Sladic, Andre Fachat, Ettore Perazzoli, Teemu Rantanen, Jouko Valta, Jarkko Sonninen, Mikkel Holm Olsen, Manuel Antonio Rodriguez Bas, Paul Dube, Czirkos Zoltan, Karai Csaba, Andrea Musuruane, Jesse Lee, Jarek Sobolewski, Michael Litvinov, Peter Krefting, Emir Akaydin.",
  license:
    'VICE is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.',
  website: 'https://vice-emu.sourceforge.io/'
};

@injectable()
export class CommodoreCommanderGettingStartedWidget extends GettingStartedWidget {
  @inject(OpenerService)
  protected readonly openerService!: OpenerService;

  @postConstruct()
  protected override init(): void {
    super.init();
  }

  protected override async doInit(): Promise<void> {
    await super.doInit();
    // Commodore Commander does not advertise Theia AI on its welcome page.
    this.aiIsIncluded = false;
    this.update();
  }

  protected override renderHeader(): React.ReactNode {
    return (
      <div className='gs-header cc-welcome-header'>
        <div className='cc-welcome-brand-row'>
          <img
            alt={`${this.applicationName} application icon`}
            className='cc-welcome-app-icon'
            src={COMMODORE_COMMANDER_APP_ICON_URL}
          />
          <div className='cc-welcome-title-block'>
            <h1>{this.applicationName}</h1>
            <p className='cc-welcome-tagline'>
              A desktop workbench for building Commodore computer programs.
            </p>
          </div>
        </div>
        <div className='cc-welcome-summary'>
          <p>
            Commodore Commander brings support for building applications for the classical 7-bit Commodore computers,
          </p>
          <p>
            The workbench keeps 6502 mnemonic help, C64 I/O register reference
            data, build output, and emulator-oriented runtime support close to
            the source code so existing assembly projects can be inspected,
            assembled, and prepared for local runs from one place.
          </p>
        </div>
        {this.renderEmbeddedViceBranding()}
      </div>
    );
  }

  protected renderEmbeddedViceBranding(): React.ReactNode {
    return (
      <section
        aria-labelledby='cc-welcome-vice-heading'
        className='cc-welcome-embedded-runtime'
      >
        <div className='cc-welcome-runtime-heading'>
          <span className='cc-welcome-runtime-kicker'>Embedded runtime</span>
          <h2 id='cc-welcome-vice-heading'>
            {VICE_BRANDING.shortName} - {VICE_BRANDING.name}
          </h2>
        </div>
        <p>
          Commodore Commander includes VICE {VICE_BRANDING.version} for local
          emulator launch support. {VICE_BRANDING.description}
        </p>
        <p>
          {VICE_BRANDING.license}{' '}
          <a href={VICE_BRANDING.website} rel='noreferrer' target='_blank'>
            See the VICE project website for details.
          </a>
        </p>
        <details className='cc-welcome-runtime-details'>
          <summary>VICE copyright holders</summary>
          <p>{VICE_BRANDING.copyright}</p>
        </details>
      </section>
    );
  }

  protected override renderHelp(): React.ReactNode {
    return (
      <div className='gs-section'>
        <h3 className='gs-section-header'>
          <i className={codicon('book')} />
          Help
        </h3>
        {BUNDLED_DOCUMENTS.map(document => (
          <div className='gs-action-container' key={document.path}>
            <a
              role='button'
              tabIndex={0}
              onClick={event =>
                this.doOpenBundledDocumentation(event, document.path)
              }
              onKeyDown={event =>
                this.doOpenBundledDocumentationEnter(event, document.path)
              }
            >
              {document.label}
            </a>
            <span className='gs-action-details'>{document.details}</span>
          </div>
        ))}
        <div className='gs-action-container'>
          <a
            role='button'
            tabIndex={0}
            onClick={() => this.doOpenExternalLink(VICE_BRANDING.website)}
            onKeyDown={(event) =>
              this.doOpenExternalLinkEnter(event, VICE_BRANDING.website)
            }
          >
            VICE Project
          </a>
          <span className='gs-action-details'>
            Emulator documentation and project information
          </span>
        </div>
      </div>
    );
  }

  protected doOpenBundledDocumentation(
    event: React.MouseEvent,
    relativePath: string
  ): void {
    event.preventDefault();
    void openBundledDocumentationPreview(this.openerService, relativePath);
  }

  protected doOpenBundledDocumentationEnter(
    event: React.KeyboardEvent,
    relativePath: string
  ): void {
    if (!this.isEnterKey(event)) {
      return;
    }

    event.preventDefault();
    void openBundledDocumentationPreview(this.openerService, relativePath);
  }
}
