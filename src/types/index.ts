// Sheet Group interface definition
export interface SheetGroup {
  name: string;
  pathName: string;
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
