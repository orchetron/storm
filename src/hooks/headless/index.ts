/**
 * Headless behavior hooks — extract component behavior without rendering.
 *
 * Each hook replicates the exact keyboard handling, state management,
 * and focus behavior of its corresponding component, returning state +
 * props objects that can be used to build custom UIs.
 */

// Input behaviors
export {
  useSelectBehavior,
  type UseSelectBehaviorOptions,
  type UseSelectBehaviorResult,
  type SelectBehaviorOption,
} from "./useSelectBehavior.js";

export {
  useListBehavior,
  type UseListBehaviorOptions,
  type UseListBehaviorResult,
  type ListBehaviorItem,
} from "./useListBehavior.js";

export {
  useMenuBehavior,
  type UseMenuBehaviorOptions,
  type UseMenuBehaviorResult,
  type MenuBehaviorItem,
  type SubmenuFrame,
} from "./useMenuBehavior.js";

export {
  useTreeBehavior,
  type UseTreeBehaviorOptions,
  type UseTreeBehaviorResult,
  type TreeBehaviorNode,
  type FlatTreeNode,
} from "./useTreeBehavior.js";

// Navigation behaviors
export {
  useTabsBehavior,
  type UseTabsBehaviorOptions,
  type UseTabsBehaviorResult,
  type TabBehaviorItem,
} from "./useTabsBehavior.js";

export {
  useAccordionBehavior,
  type UseAccordionBehaviorOptions,
  type UseAccordionBehaviorResult,
  type AccordionBehaviorSection,
} from "./useAccordionBehavior.js";

export {
  usePaginatorBehavior,
  type UsePaginatorBehaviorOptions,
  type UsePaginatorBehaviorResult,
} from "./usePaginatorBehavior.js";

export {
  useStepperBehavior,
  type UseStepperBehaviorOptions,
  type UseStepperBehaviorResult,
  type StepBehaviorDef,
  type StepStatus,
} from "./useStepperBehavior.js";

// Data behaviors
export {
  useTableBehavior,
  type UseTableBehaviorOptions,
  type UseTableBehaviorResult,
  type TableBehaviorColumn,
  type TableBehaviorEditing,
} from "./useTableBehavior.js";

export {
  useVirtualListBehavior,
  type UseVirtualListBehaviorOptions,
  type UseVirtualListBehaviorResult,
} from "./useVirtualListBehavior.js";

// Dialog behaviors
export {
  useDialogBehavior,
  type UseDialogBehaviorOptions,
  type UseDialogBehaviorResult,
  type DialogSize,
} from "./useDialogBehavior.js";

export {
  useToastBehavior,
  type UseToastBehaviorOptions,
  type UseToastBehaviorResult,
  type ToastBehaviorItem,
} from "./useToastBehavior.js";

// Form behaviors
export {
  useFormBehavior,
  type UseFormBehaviorOptions,
  type UseFormBehaviorResult,
  type FormBehaviorField,
  type FormBehaviorFieldOption,
} from "./useFormBehavior.js";

export {
  useCalendarBehavior,
  type UseCalendarBehaviorOptions,
  type UseCalendarBehaviorResult,
  type CalendarDayInfo,
} from "./useCalendarBehavior.js";

export {
  useCollapsibleBehavior,
  type UseCollapsibleBehaviorOptions,
  type UseCollapsibleBehaviorResult,
} from "./useCollapsibleBehavior.js";
