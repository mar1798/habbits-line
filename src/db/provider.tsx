import { SQLiteProvider } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';

import { migrate } from './migrations';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="habits.db" onInit={migrate} useSuspense>
      {children}
    </SQLiteProvider>
  );
}
