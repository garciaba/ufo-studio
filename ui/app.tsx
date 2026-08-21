import React from 'react';
import { AppRoot } from '@dynatrace/strato-components/core';
import { AppHeader, Flex, HelpMenu } from '@dynatrace/strato-components/layouts';
import { FleetList } from './components/FleetList';

export function App() {
  return (
    <AppRoot>
      <Flex flexDirection="column">
        <AppHeader>
          <AppHeader.Navigation>
            <AppHeader.Logo />
          </AppHeader.Navigation>
          <AppHeader.Menus>
            <HelpMenu entries={{ about: 'default' }} />
          </AppHeader.Menus>
        </AppHeader>
        <Flex flexDirection="column" gap={24} padding={32}>
          <FleetList />
        </Flex>
      </Flex>
    </AppRoot>
  );
}
