declare module "react-reconciler" {
  import type { ReactNode } from "react";

  interface HostConfig<
    Type, Props, Container, Instance, TextInstance,
    SuspenseInstance, HydratableInstance, PublicInstance,
    HostContext, UpdatePayload, ChildSet, TimeoutHandle, NoTimeout
  > {
    supportsMutation: boolean;
    supportsPersistence: boolean;
    supportsHydration: boolean;
    isPrimaryRenderer: boolean;
    noTimeout: NoTimeout;

    createInstance(type: Type, props: Props, rootContainer: Container, hostContext: HostContext, internalHandle: unknown): Instance;
    createTextInstance(text: string, rootContainer: Container, hostContext: HostContext, internalHandle: unknown): TextInstance;
    appendInitialChild(parentInstance: Instance, child: Instance | TextInstance): void;
    appendChild(parentInstance: Instance, child: Instance | TextInstance): void;
    appendChildToContainer(container: Container, child: Instance | TextInstance): void;
    removeChild(parentInstance: Instance, oldChild: Instance | TextInstance): void;
    removeChildFromContainer(container: Container, child: Instance | TextInstance): void;
    insertBefore(parentInstance: Instance, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void;
    insertInContainerBefore(container: Container, child: Instance | TextInstance, beforeChild: Instance | TextInstance): void;
    clearContainer(container: Container): void;
    prepareUpdate(instance: Instance, type: Type, oldProps: Props, newProps: Props, rootContainer: Container, hostContext: HostContext): UpdatePayload;
    commitUpdate(instance: Instance, updatePayload: UpdatePayload, type: Type, prevProps: Props, nextProps: Props, internalHandle: unknown): void;
    commitTextUpdate(textInstance: TextInstance, oldText: string, newText: string): void;
    prepareForCommit(containerInfo: Container): Record<string, unknown> | null;
    resetAfterCommit(containerInfo: Container): void;
    finalizeInitialChildren(instance: Instance, type: Type, props: Props, rootContainer: Container, hostContext: HostContext): boolean;
    getPublicInstance(instance: Instance): PublicInstance;
    getRootHostContext(rootContainer: Container): HostContext;
    getChildHostContext(parentHostContext: HostContext, type: Type, rootContainer: Container): HostContext;
    shouldSetTextContent(type: Type, props: Props): boolean;
    preparePortalMount(containerInfo: Container): void;
    scheduleTimeout(fn: (...args: unknown[]) => unknown, delay?: number): TimeoutHandle;
    cancelTimeout(id: TimeoutHandle): void;
    getCurrentEventPriority(): number;
    getInstanceFromNode(node: unknown): unknown;
    prepareScopeUpdate(scopeInstance: unknown, instance: unknown): void;
    getInstanceFromScope(scopeInstance: unknown): unknown;
    beforeActiveInstanceBlur(): void;
    afterActiveInstanceBlur(): void;
    detachDeletedInstance(node: Instance): void;
    requestPostPaintCallback(callback: (endTime: number) => void): void;
    maySuspendCommit(type: Type, props: Props): boolean;
    preloadInstance(type: Type, props: Props): boolean;
    startSuspendingCommit(): void;
    suspendInstance(type: Type, props: Props): void;
    waitForCommitToBeReady(): null;
    NotPendingTransition: null;
    resetFormInstance(instance: Instance): void;
    setCurrentUpdatePriority(newPriority: number): void;
    getCurrentUpdatePriority(): number;
    resolveUpdatePriority(): number;
  }

  interface Reconciler<Container> {
    createContainer(
      containerInfo: Container,
      tag: number,
      hydrationCallbacks: null,
      isStrictMode: boolean,
      concurrentUpdatesByDefaultOverride: null,
      identifierPrefix: string,
      onRecoverableError: (error: Error) => void,
      transitionCallbacks: null,
    ): unknown;
    updateContainer(
      element: ReactNode | null,
      container: unknown,
      parentComponent: null,
      callback: (() => void) | null,
    ): void;
    flushSyncFromReconciler(fn: () => void): void;
  }

  function createReconciler<
    Type, Props, Container, Instance, TextInstance,
    SuspenseInstance, HydratableInstance, PublicInstance,
    HostContext, UpdatePayload, ChildSet, TimeoutHandle, NoTimeout
  >(
    config: HostConfig<Type, Props, Container, Instance, TextInstance, SuspenseInstance, HydratableInstance, PublicInstance, HostContext, UpdatePayload, ChildSet, TimeoutHandle, NoTimeout>,
  ): Reconciler<Container>;

  export = createReconciler;
}

declare module "react-reconciler/constants.js" {
  export const DefaultEventPriority: number;
  export const DiscreteEventPriority: number;
  export const ContinuousEventPriority: number;
  export const IdleEventPriority: number;
}
