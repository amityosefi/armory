// Sheet Group interface definition
export interface SheetGroup {
  name: string;
  pathName: string;
  /**
   * Permission key for the whole group, when it differs from `pathName`.
   * Groups that set it are gated on this key alone - they are exempt from the
   * company-permission fallback in GroupNavigation.
   */
  permissionKey?: string;
  sheets: Array<{
    name: string;
    range: string;
    id: number;
  }>;
}

export interface TabsNavigationProps {
  sheets: Array<{
    name: string;
    range: string;
    id: number;
  }>;
  activeTabIndex: number;
  onTabChange: (index: number) => void;
}
