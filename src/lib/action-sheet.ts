import { ActionSheetIOS } from 'react-native';

import type { ThemeScheme } from '@/hooks/use-theme';

export type ActionSheetAction = {
  id: string;
  title: string;
  destructive?: boolean;
};

/**
 * The one place that builds an `ActionSheetIOS` menu, so the four spots in the app that
 * need a "•••" / long-press menu can't drift into different button orders or a missing
 * Cancel. `MenuView`'s SwiftUI `Menu` has no close hook to forward to JS (see
 * `node_modules/@expo/ui/build/community/menu/types.d.ts`), so a tap outside it leaks
 * through to whatever is underneath — an actual modal sheet does not have that problem.
 */
export function showActionSheet(
  options: {
    scheme: ThemeScheme;
    cancelLabel: string;
    actions: ActionSheetAction[];
  },
  onSelect: (id: string) => void
) {
  const { scheme, cancelLabel, actions } = options;
  const destructiveButtonIndex = actions.findIndex((action) => action.destructive);
  const buttonLabels = [...actions.map((action) => action.title), cancelLabel];
  const cancelButtonIndex = buttonLabels.length - 1;

  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: buttonLabels,
      cancelButtonIndex,
      destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
      userInterfaceStyle: scheme,
    },
    (buttonIndex) => {
      if (buttonIndex === cancelButtonIndex) return;
      const action = actions[buttonIndex];
      if (action) onSelect(action.id);
    }
  );
}
