import { InterceptorFn, ErrorInterceptorFn, Interceptor } from '../types/index';

export class InterceptorManager<T> {
  private handlers: Array<Interceptor<T> | null> = [];

  use(fulfilled: InterceptorFn<T>, rejected?: ErrorInterceptorFn): number {
    this.handlers.push({
      fulfilled,
      rejected
    });
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  forEach(fn: (handler: Interceptor<T>) => void): void {
    this.handlers.forEach(handler => {
      if (handler !== null) {
        fn(handler);
      }
    });
  }

  getHandlers(): Array<Interceptor<T>> {
    return this.handlers.filter((handler): handler is Interceptor<T> => handler !== null);
  }

  clear(): void {
    this.handlers = [];
  }
} 