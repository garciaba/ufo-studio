import React from 'react';
import { AppRoot } from '@dynatrace/strato-components/core';
import { PageLayout, AppHeader, HelpMenu } from '@dynatrace/strato-components/layouts';
import { FleetList } from './components/FleetList';

export function App() {
  return (
    <AppRoot>
      <PageLayout>
        <PageLayout.Header>
          <AppHeader>
            <AppHeader.Navigation>
              <AppHeader.Logo />
            </AppHeader.Navigation>
            <AppHeader.Menus>
              <HelpMenu entries={{ about: 'default' }} />
            </AppHeader.Menus>
          </AppHeader>
        </PageLayout.Header>
        <PageLayout.Content>
          <FleetList />
        </PageLayout.Content>
      </PageLayout>
    </AppRoot>
  );
}
